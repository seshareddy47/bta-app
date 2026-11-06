-- Bala Tripura Arcade (BTA) — initial production schema
-- Run once in Supabase SQL Editor (Project > SQL Editor > New query), top to bottom.
-- Meant to run against a fresh project only (confirmed: nwdpoyowqnhumfgqebtm has no data yet).
--
-- Column names are camelCase (quoted) to match src/types/index.ts 1:1 where tables mirror
-- existing app data (employees, stocks, sales, services). New tables added for this phase
-- (staff_profiles, customers, inventory_movements, service_history, audit_logs) use
-- snake_case table names with camelCase columns for consistency with the rest of the schema.
--
-- SECURITY MODEL
-- Protected columns (staff_profiles.role/active, stocks.quantity, employees.salary,
-- services.deletedAt) are enforced with database privileges, not session flags:
--   * The real data for each lives in a "_base" table (staff_profiles_base, stocks_base,
--     employees_base, services_base) that has ZERO privilege grants to
--     `authenticated`/`anon`/PUBLIC — REVOKE ALL, no exceptions. Every legitimate access path
--     is one of:
--       (a) a same-named VIEW (staff_profiles / stocks / employees / services) that the app
--           already queries unchanged, with its own row filter + INSTEAD OF triggers, or
--       (b) a narrowly scoped SECURITY DEFINER function (adjust_stock, set_staff_role,
--           bootstrap_first_admin, handle_new_user) that operates on the _base table
--           directly — these run as the function owner (bypassing grants/RLS on the _base
--           table entirely), which is exactly why they're the only privileged path.
--   * staff_profiles.role/active and stocks.quantity: the views' INSTEAD OF UPDATE triggers
--     never write these columns at all (they simply don't include them in the underlying
--     UPDATE's SET list), so a client PATCH that includes them silently has no effect.
--   * services.deletedAt goes further: the `services` VIEW doesn't expose a deletedAt column
--     at all (it isn't in the view's SELECT list), so no INSERT/UPDATE through the view can
--     reference it even in principle — PostgREST/Postgres reject any payload that names a
--     column the view doesn't have. The only thing that ever sets it is
--     services_view_delete(), writing straight to services_base.
--   * employees.salary is additionally masked to NULL for non-admin readers in the view
--     projection itself (`case when is_admin() then salary else null end`).
--   * Every INSTEAD OF trigger syncs NEW back to the true stored values before returning, so
--     PostgREST's `Prefer: return=representation` (e.g. `.insert(x).select()` in supabase-js)
--     reflects reality rather than the client's original (possibly bogus/defaulted) payload.
--   * audit_logs / inventory_movements / service_history are insert-only via trigger or RPC;
--     authenticated/anon have no INSERT/UPDATE/DELETE grant on them at all.
--   * anon (unauthenticated API requests) has zero access to every table/view in this schema,
--     and future tables/functions default to no anon access too (see the ALTER DEFAULT
--     PRIVILEGES statement in section 10) — not just the ones created by this file. PUBLIC is
--     revoked everywhere a privilege could exist.
--   * Every SECURITY DEFINER function explicitly REVOKEs from public, anon, AND authenticated
--     (not just "public") before selectively re-granting — Supabase's default privileges
--     grant EXECUTE on new functions to anon/authenticated automatically, so revoking only
--     from the PUBLIC pseudo-role is not sufficient on its own.
--   * Every SECURITY DEFINER function uses `set search_path = ''` (empty) and fully qualifies
--     every single reference, INCLUDING built-ins like gen_random_uuid()/now()/
--     jsonb_build_object() as `pg_catalog.foo()`.
--   * bootstrap_first_admin() is a one-time escape hatch for a fresh project (see section 11)
--     — NO API role (PUBLIC, anon, or authenticated) is ever granted EXECUTE on it, only a
--     SQL Editor session (which runs as a superuser/table owner and can call any function
--     regardless of grants) can invoke it. It also refuses to run once any admin already
--     exists. Drop it after first use (instructions in section 11).
--   * Deleting a product or a service request soft-deletes it so inventory_movements/
--     service_history is never destroyed; the FKs additionally use ON DELETE RESTRICT as a
--     backstop against ever hard-deleting a row that still has movement/status history.
--   * adjust_stock() explicitly validates its inputs (non-null/non-zero delta, non-blank
--     reason) and the resulting quantity (rejecting negative results with a clear error)
--     before touching any data, and locks the row with SELECT ... FOR UPDATE so concurrent
--     calls for the same product serialize correctly; the quantity update and its
--     inventory_movements log entry happen in the same function invocation (one transaction),
--     so either both apply or neither does.
--
-- See supabase/tests/verify_access.sql for read-only + transactional verification queries
-- covering anonymous, inactive, admin, stock, and service access (including RPC attempts).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. STAFF PROFILES (login accounts — separate from the `employees` business roster)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.staff_profiles_base (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'stock', 'service')),
  active boolean not null default true,
  "createdAt" timestamptz not null default pg_catalog.now()
);

create index if not exists staff_profiles_role_idx on public.staff_profiles_base (role);

-- Auto-create a staff_profiles_base row when a new auth user signs up. Role/active are NEVER
-- taken from client-supplied auth metadata — any caller of supabase.auth.signUp() can set
-- arbitrary user_metadata, so trusting raw_user_meta_data->>'role' would let a new signup
-- grant itself 'admin'. Every new account starts lowest-privilege and INACTIVE — this is the
-- "minimum access for onboarding" state: they can see and edit their own name/email via the
-- `staff_profiles` view (so the UI can show "pending approval"), but staff_role()/is_admin()
-- both require active = true, so they get zero rows from every other business table/view and
-- cannot call adjust_stock()/set_staff_role(). An existing admin must call set_staff_role()
-- (or, for the very first admin, bootstrap_first_admin() — see section 11) to activate them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles_base (id, name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    'service',
    false
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper functions used throughout RLS policies and view row-filters (SECURITY DEFINER +
-- empty search_path with fully-qualified references, so they can read staff_profiles_base
-- regardless of the caller's own privileges, without recursing back into any view/RLS on it,
-- and without any risk of search-path hijacking since nothing is resolved unqualified).
create or replace function public.staff_role(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_profiles_base where id = uid and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles_base
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

revoke all on function public.staff_role(uuid) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.staff_role(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Client-facing view: a non-admin sees only their own row (regardless of active status — an
-- inactive/pending user must still be able to see their own profile), an admin sees every
-- row. This view (not RLS on the base table — see the grants in section 10) is the actual
-- access control for reads, since a view's underlying-table access runs as the view owner,
-- who bypasses RLS on staff_profiles_base by owning it.
create or replace view public.staff_profiles as
  select * from public.staff_profiles_base
  where auth.uid() = id or public.is_admin();

-- Lets a user (or an admin, on anyone's behalf) edit their own display name/email — including
-- while inactive/pending, which is the minimum needed for onboarding. role and active are
-- deliberately absent from the UPDATE's SET list — not conditionally skipped, just never
-- written here — so no PATCH through this view can ever change them, regardless of what value
-- the client sends. The only way to change role/active is set_staff_role() (section 9), which
-- writes straight to staff_profiles_base and never goes through this trigger at all. NEW is
-- re-synced to the true stored role/active so a chained `.select()` reflects reality.
create or replace function public.staff_profiles_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (auth.uid() = old.id or public.is_admin()) then
    raise exception 'not authorized to update this profile';
  end if;

  update public.staff_profiles_base
    set name = new.name,
        email = new.email
    where id = old.id;

  new.role := old.role;
  new.active := old.active;
  return new;
end;
$$;

revoke all on function public.staff_profiles_view_update() from public, anon, authenticated;

drop trigger if exists staff_profiles_view_update_trg on public.staff_profiles;
create trigger staff_profiles_view_update_trg
  instead of update on public.staff_profiles
  for each row execute function public.staff_profiles_view_update();

-- No INSTEAD OF INSERT/DELETE trigger is defined for this view on purpose: clients never
-- create or delete their own auth-linked profile row directly (handle_new_user does the only
-- legitimate insert, straight into staff_profiles_base), so those statements simply fail.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. EMPLOYEES (existing business roster — salary/phone/role, distinct from login accounts)
--    Salary is sensitive, so the real data lives in employees_base (zero API grants) and
--    `employees` is a view that masks salary for non-admins and forwards writes to
--    employees_base via INSTEAD OF triggers. The app keeps querying "employees" unchanged —
--    no React/TypeScript changes are required for this. Deleting an employee who already has
--    sales/service records referencing them is blocked by the default FK behavior (RESTRICT,
--    since no ON DELETE clause is specified below) rather than cascading data loss.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.employees_base (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  "empId" text unique not null,
  name text not null,
  role text not null check (role in ('manager', 'sales', 'technician', 'admin')),
  phone text not null,
  email text not null,
  "joinDate" date not null,
  salary numeric not null default 0 check (salary >= 0),
  status text not null check (status in ('active', 'inactive')) default 'active'
);

-- Visible to any active staff member; salary is replaced with null unless the caller is an
-- admin. is_admin()/staff_role() are SECURITY DEFINER so this filter doesn't depend on the
-- caller having any privilege on staff_profiles_base.
create or replace view public.employees as
  select
    id, "empId", name, role, phone, email, "joinDate", status,
    case when public.is_admin() then salary else null end as salary
  from public.employees_base
  where public.staff_role(auth.uid()) is not null;

create or replace function public.employees_view_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.employees_base;
begin
  if not public.is_admin() then
    raise exception 'only admins can add employees';
  end if;
  insert into public.employees_base (id, "empId", name, role, phone, email, "joinDate", salary, status)
  values (
    coalesce(new.id, pg_catalog.gen_random_uuid()), new."empId", new.name, new.role, new.phone, new.email,
    new."joinDate", coalesce(new.salary, 0), coalesce(new.status, 'active')
  )
  returning * into v_row;

  new.id := v_row.id;
  new.salary := v_row.salary;
  new.status := v_row.status;
  return new;
end;
$$;

create or replace function public.employees_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can update employees';
  end if;
  update public.employees_base set
    "empId" = new."empId",
    name = new.name,
    role = new.role,
    phone = new.phone,
    email = new.email,
    "joinDate" = new."joinDate",
    salary = new.salary,
    status = new.status
  where id = old.id;
  return new;
end;
$$;

create or replace function public.employees_view_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins can delete employees';
  end if;
  delete from public.employees_base where id = old.id;
  return old;
end;
$$;

revoke all on function public.employees_view_insert() from public, anon, authenticated;
revoke all on function public.employees_view_update() from public, anon, authenticated;
revoke all on function public.employees_view_delete() from public, anon, authenticated;

drop trigger if exists employees_view_insert_trg on public.employees;
create trigger employees_view_insert_trg
  instead of insert on public.employees
  for each row execute function public.employees_view_insert();

drop trigger if exists employees_view_update_trg on public.employees;
create trigger employees_view_update_trg
  instead of update on public.employees
  for each row execute function public.employees_view_update();

drop trigger if exists employees_view_delete_trg on public.employees;
create trigger employees_view_delete_trg
  instead of delete on public.employees
  for each row execute function public.employees_view_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CUSTOMERS — business records only (name/phone/email/address for sales + service
--    requests). Deliberately NOT linked to auth.users and has no id/role/active columns of
--    its own, so it cannot become a login identity by accident. A future customer-facing
--    portal must introduce its own separate auth-linked table (e.g. customer_profiles) and
--    its own RLS/role model — it must never reuse staff_profiles_base or the admin/stock/
--    service role vocabulary, keeping staff and customer privileges structurally separate.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  "createdAt" timestamptz not null default pg_catalog.now()
);

create index if not exists customers_phone_idx on public.customers (phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STOCKS (products) — quantity is the protected column, enforced the same way as
--    staff_profiles.role/active: stocks_base has zero API grants, `stocks` is a view whose
--    INSTEAD OF UPDATE trigger never writes quantity, and only adjust_stock() (section 5)
--    may change it, by writing to stocks_base directly. Deletion is soft (see "deletedAt")
--    so inventory_movements history is never lost.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.stocks_base (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  sku text not null,
  "productName" text not null,
  category text not null check (category in (
    'split-ac', 'window-ac', 'cassette-ac', 'tower-ac',
    'air-cooler', 'deep-freezer', 'water-dispenser'
  )),
  -- Tonnage/star rating only apply to AC categories; nullable here and enforced below.
  tonnage text check (tonnage in ('1T', '1.5T', '2T')),
  "starRating" smallint check ("starRating" in (3, 4, 5)),
  "modelNumber" text not null,
  price numeric not null default 0 check (price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  "minStock" integer not null default 0 check ("minStock" >= 0),
  location text not null default '',
  "lastUpdated" timestamptz not null default pg_catalog.now(),
  "deletedAt" timestamptz,
  -- AC categories must have both tonnage and starRating; every other category must have neither.
  constraint stocks_base_ac_attrs_check check (
    (category in ('split-ac', 'window-ac', 'cassette-ac', 'tower-ac')
      and tonnage is not null and "starRating" is not null)
    or
    (category not in ('split-ac', 'window-ac', 'cassette-ac', 'tower-ac')
      and tonnage is null and "starRating" is null)
  )
);

create index if not exists stocks_category_idx on public.stocks_base (category);
-- Partial (not plain) unique index: a SKU can be reused once the old row is soft-deleted,
-- while still preventing two simultaneously-active products from sharing a SKU.
create unique index if not exists stocks_base_sku_active_idx
  on public.stocks_base (sku) where "deletedAt" is null;

-- admin + stock roles only — service role has no access to inventory data, at the view
-- layer. Soft-deleted rows are excluded so a "delete" still disappears from the app exactly
-- like before, with no React changes required. Column list is explicit (not `select *`) so
-- "deletedAt" never leaks into the client-facing shape, and — just as importantly — can never
-- be targeted by a client INSERT/UPDATE through this view at all, since it isn't a column the
-- view exposes.
create or replace view public.stocks as
  select
    id, sku, "productName", category, tonnage, "starRating", "modelNumber",
    price, quantity, "minStock", location, "lastUpdated"
  from public.stocks_base
  where public.staff_role(auth.uid()) in ('admin', 'stock')
    and "deletedAt" is null;

create or replace function public.stocks_view_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stocks_base;
begin
  if public.staff_role(auth.uid()) not in ('admin', 'stock') then
    raise exception 'not authorized to add stock';
  end if;

  insert into public.stocks_base
    (id, sku, "productName", category, tonnage, "starRating", "modelNumber", price, quantity, "minStock", location, "lastUpdated")
  values (
    coalesce(new.id, pg_catalog.gen_random_uuid()), new.sku, new."productName", new.category, new.tonnage,
    new."starRating", new."modelNumber", new.price, coalesce(new.quantity, 0),
    new."minStock", coalesce(new.location, ''), pg_catalog.now()
  )
  returning * into v_row;

  new.id := v_row.id;
  new.quantity := v_row.quantity;
  new.location := v_row.location;
  new."lastUpdated" := v_row."lastUpdated";
  return new;
end;
$$;

-- Every column EXCEPT quantity is forwarded from NEW. There is no condition to satisfy or
-- flag to set to "unlock" quantity here — it is simply never part of this UPDATE statement,
-- so a client PATCH that includes a different quantity value has no effect on it at all. NEW
-- is re-synced to the true (unchanged) quantity so a chained `.select()` reflects reality.
create or replace function public.stocks_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role(auth.uid()) not in ('admin', 'stock') then
    raise exception 'not authorized to update stock';
  end if;

  update public.stocks_base set
    sku = new.sku,
    "productName" = new."productName",
    category = new.category,
    tonnage = new.tonnage,
    "starRating" = new."starRating",
    "modelNumber" = new."modelNumber",
    price = new.price,
    "minStock" = new."minStock",
    location = new.location,
    "lastUpdated" = pg_catalog.now()
  where id = old.id;

  new.quantity := old.quantity;
  return new;
end;
$$;

-- Soft delete only: marks "deletedAt" instead of removing the row, so inventory_movements
-- (which references stocks_base with ON DELETE RESTRICT, see section 5) is never orphaned or
-- destroyed, and the product's full audit history remains queryable by admins/stock staff.
create or replace function public.stocks_view_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role(auth.uid()) not in ('admin', 'stock') then
    raise exception 'not authorized to delete stock';
  end if;
  update public.stocks_base set "deletedAt" = pg_catalog.now()
    where id = old.id and "deletedAt" is null;
  return old;
end;
$$;

revoke all on function public.stocks_view_insert() from public, anon, authenticated;
revoke all on function public.stocks_view_update() from public, anon, authenticated;
revoke all on function public.stocks_view_delete() from public, anon, authenticated;

drop trigger if exists stocks_view_insert_trg on public.stocks;
create trigger stocks_view_insert_trg
  instead of insert on public.stocks
  for each row execute function public.stocks_view_insert();

drop trigger if exists stocks_view_update_trg on public.stocks;
create trigger stocks_view_update_trg
  instead of update on public.stocks
  for each row execute function public.stocks_view_update();

drop trigger if exists stocks_view_delete_trg on public.stocks;
create trigger stocks_view_delete_trg
  instead of delete on public.stocks
  for each row execute function public.stocks_view_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INVENTORY MOVEMENTS (append-only audit trail) + the only path that may change quantity
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inventory_movements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  -- ON DELETE RESTRICT (not CASCADE): a product can never be hard-deleted while it still has
  -- movement history. The normal "delete" path is the soft-delete above, which never trips
  -- this at all since the row is never actually removed.
  "productId" uuid not null references public.stocks_base (id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason text not null check (pg_catalog.length(pg_catalog.btrim(reason)) > 0),
  "performedBy" uuid references public.staff_profiles_base (id),
  "createdAt" timestamptz not null default pg_catalog.now()
);

create index if not exists inventory_movements_product_idx on public.inventory_movements ("productId");

-- Records an audit entry for the initial quantity when a product is first created, so
-- inventory_movements reflects a product's full history from day one, for any insert path
-- into stocks_base (the view's INSTEAD OF INSERT trigger included).
create or replace function public.log_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quantity <> 0 then
    insert into public.inventory_movements ("productId", delta, reason, "performedBy")
    values (new.id, new.quantity, 'Initial stock', auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.log_initial_stock() from public, anon, authenticated;

drop trigger if exists stocks_log_initial on public.stocks_base;
create trigger stocks_log_initial
  after insert on public.stocks_base
  for each row execute function public.log_initial_stock();

-- Atomically adjusts stock quantity and records the movement, writing to stocks_base
-- directly (bypassing the `stocks` view and its quantity-ignoring UPDATE trigger entirely —
-- this function is the one deliberately-scoped exception). Validates its inputs explicitly
-- (non-null/non-zero delta, non-blank reason) before touching any data, locks the target row
-- with SELECT ... FOR UPDATE (so concurrent calls for the same product serialize instead of
-- racing), and explicitly rejects a negative resulting quantity with a clear error — the
-- quantity >= 0 CHECK constraint on stocks_base remains as a backstop either way. The
-- quantity update and its inventory_movements log entry happen inside this single function
-- invocation (one transaction, no intermediate commits), so either both apply or neither does
-- — an exception at any point here aborts the whole thing, including any partial write.
create or replace function public.adjust_stock(p_product_id uuid, p_delta integer, p_reason text)
returns public.stocks_base
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.staff_role(auth.uid());
  v_row public.stocks_base;
  v_current_quantity integer;
begin
  if v_role is null or v_role not in ('admin', 'stock') then
    raise exception 'not authorized to adjust stock';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'delta must be a non-null, non-zero integer (got %)', p_delta;
  end if;

  if p_reason is null or pg_catalog.length(pg_catalog.btrim(p_reason)) = 0 then
    raise exception 'reason must not be null or blank';
  end if;

  select quantity into v_current_quantity
    from public.stocks_base
    where id = p_product_id and "deletedAt" is null
    for update;

  if v_current_quantity is null then
    raise exception 'product % not found (or deleted)', p_product_id;
  end if;

  if v_current_quantity + p_delta < 0 then
    raise exception 'insufficient stock: % + (%) would be negative', v_current_quantity, p_delta;
  end if;

  update public.stocks_base
    set quantity = quantity + p_delta,
        "lastUpdated" = pg_catalog.now()
    where id = p_product_id
    returning * into v_row;

  insert into public.inventory_movements ("productId", delta, reason, "performedBy")
  values (p_product_id, p_delta, p_reason, auth.uid());

  return v_row;
end;
$$;

revoke all on function public.adjust_stock(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SALES
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  "invoiceNumber" text unique not null,
  date date not null,
  time text not null,
  "paymentMethod" text not null,
  "employeeId" uuid references public.employees_base (id),
  "employeeName" text not null default '',
  "storeLocation" text not null default '',
  "gstApplicable" boolean not null default false,
  status text not null check (status in ('completed', 'pending', 'cancelled')) default 'pending',
  "customerId" uuid references public.customers (id),
  "customerName" text not null default '',
  "customerPhone" text not null default '',
  "customerEmail" text not null default '',
  "customerType" text not null default 'individual',
  "billingAddress" text not null default '',
  "shippingAddress" text not null default '',
  gstin text not null default '',
  "leadSource" text not null default 'walk-in',
  pan text not null default '',
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  "totalDiscount" numeric not null default 0,
  "gstAmount" numeric not null default 0,
  "installationCharges" numeric not null default 0,
  "deliveryCharges" numeric not null default 0,
  "otherCharges" numeric not null default 0,
  "totalAmount" numeric not null default 0 check ("totalAmount" >= 0),
  "amountPaid" numeric not null default 0 check ("amountPaid" >= 0),
  "balanceDue" numeric not null default 0,
  "dueDate" date,
  "installationRequired" boolean not null default false,
  "installationDate" date,
  "assignedTechnicianId" uuid references public.employees_base (id),
  "assignedTechnicianName" text not null default '',
  "installationStatus" text not null default 'pending',
  "extraMaterialCharges" numeric not null default 0,
  "amcSold" boolean not null default false,
  "extendedWarrantySold" boolean not null default false,
  "expectedDeliveryDate" date,
  "customerSegment" text not null default 'mid-range',
  season text not null default '',
  "salesCampaignId" text not null default '',
  "targetCategory" text not null default 'retail',
  "productId" text not null default '',
  "productName" text not null default '',
  "unitPrice" numeric not null default 0,
  quantity integer not null default 0,
  notes text
);

create index if not exists sales_date_idx on public.sales (date);
create index if not exists sales_customer_idx on public.sales ("customerId");

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SERVICE REQUESTS — same protected-column architecture as stocks: the real data lives in
--    services_base (zero API grants); `services` is a view whose column list does not even
--    include "deletedAt", so no INSERT/UPDATE through the view can reference it (PostgREST
--    rejects any payload naming a column the view doesn't expose) — not a trigger that
--    merely ignores it, a column that structurally doesn't exist on the client-facing side.
--    Only services_view_delete() ever sets it, writing straight to services_base.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.services_base (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  "serialNo" text not null default '',
  "serviceNo" text not null,
  "complaintDate" date not null,
  "customerId" uuid references public.customers (id),
  "customerName" text not null default '',
  mobile text not null default '',
  area text not null default '',
  "townVillage" text not null default '',
  "invoiceNumber" text not null default '',
  "invoiceDate" date,
  "modelNumber" text not null default '',
  "complaintType" text not null,
  "attendedDate" date,
  "technicianId" uuid references public.employees_base (id),
  "technicianName" text not null default '',
  status text not null check (status in ('open', 'in-progress', 'completed', 'cancelled')) default 'open',
  "deletedAt" timestamptz
);

create index if not exists services_status_idx on public.services_base (status);
create index if not exists services_customer_idx on public.services_base ("customerId");
-- Partial unique index: a service number can be reused once the old row is soft-deleted.
create unique index if not exists services_base_serviceno_active_idx
  on public.services_base ("serviceNo") where "deletedAt" is null;

-- admin + service roles only — stock role has no access to service data, at the view layer.
-- "deletedAt" is deliberately absent from this column list (see section header) — that
-- omission, not a trigger, is what makes it unreachable via INSERT/UPDATE through the view.
create or replace view public.services as
  select
    id, "serialNo", "serviceNo", "complaintDate", "customerId", "customerName", mobile, area,
    "townVillage", "invoiceNumber", "invoiceDate", "modelNumber", "complaintType", "attendedDate",
    "technicianId", "technicianName", status
  from public.services_base
  where public.staff_role(auth.uid()) in ('admin', 'service')
    and "deletedAt" is null;

create or replace function public.services_view_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.services_base;
begin
  if public.staff_role(auth.uid()) not in ('admin', 'service') then
    raise exception 'not authorized to add a service request';
  end if;

  insert into public.services_base
    (id, "serialNo", "serviceNo", "complaintDate", "customerId", "customerName", mobile, area,
     "townVillage", "invoiceNumber", "invoiceDate", "modelNumber", "complaintType", "attendedDate",
     "technicianId", "technicianName", status)
  values (
    coalesce(new.id, pg_catalog.gen_random_uuid()), coalesce(new."serialNo", ''), new."serviceNo",
    new."complaintDate", new."customerId", coalesce(new."customerName", ''), coalesce(new.mobile, ''),
    coalesce(new.area, ''), coalesce(new."townVillage", ''), coalesce(new."invoiceNumber", ''),
    new."invoiceDate", coalesce(new."modelNumber", ''), new."complaintType", new."attendedDate",
    new."technicianId", coalesce(new."technicianName", ''), coalesce(new.status, 'open')
  )
  returning * into v_row;

  new.id := v_row.id;
  new."serialNo" := v_row."serialNo";
  new."customerName" := v_row."customerName";
  new.mobile := v_row.mobile;
  new.area := v_row.area;
  new."townVillage" := v_row."townVillage";
  new."invoiceNumber" := v_row."invoiceNumber";
  new."modelNumber" := v_row."modelNumber";
  new."technicianName" := v_row."technicianName";
  new.status := v_row.status;
  return new;
end;
$$;

create or replace function public.services_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role(auth.uid()) not in ('admin', 'service') then
    raise exception 'not authorized to update this service request';
  end if;

  update public.services_base set
    "serialNo" = new."serialNo",
    "serviceNo" = new."serviceNo",
    "complaintDate" = new."complaintDate",
    "customerId" = new."customerId",
    "customerName" = new."customerName",
    mobile = new.mobile,
    area = new.area,
    "townVillage" = new."townVillage",
    "invoiceNumber" = new."invoiceNumber",
    "invoiceDate" = new."invoiceDate",
    "modelNumber" = new."modelNumber",
    "complaintType" = new."complaintType",
    "attendedDate" = new."attendedDate",
    "technicianId" = new."technicianId",
    "technicianName" = new."technicianName",
    status = new.status
  where id = old.id;

  return new;
end;
$$;

-- Soft delete only: marks "deletedAt" on services_base directly — this function is the only
-- place in the entire schema that ever writes this column. The row then disappears from the
-- `services` view (which filters "deletedAt is null"), so it can't be selected, edited, or
-- "deleted" again afterward; service_history is preserved via ON DELETE RESTRICT (section 8).
create or replace function public.services_view_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role(auth.uid()) not in ('admin', 'service') then
    raise exception 'not authorized to delete this service request';
  end if;
  update public.services_base set "deletedAt" = pg_catalog.now()
    where id = old.id and "deletedAt" is null;
  return old;
end;
$$;

revoke all on function public.services_view_insert() from public, anon, authenticated;
revoke all on function public.services_view_update() from public, anon, authenticated;
revoke all on function public.services_view_delete() from public, anon, authenticated;

drop trigger if exists services_view_insert_trg on public.services;
create trigger services_view_insert_trg
  instead of insert on public.services
  for each row execute function public.services_view_insert();

drop trigger if exists services_view_update_trg on public.services;
create trigger services_view_update_trg
  instead of update on public.services
  for each row execute function public.services_view_update();

drop trigger if exists services_view_delete_trg on public.services;
create trigger services_view_delete_trg
  instead of delete on public.services
  for each row execute function public.services_view_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SERVICE HISTORY (append-only — written only by the status-change trigger below)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.service_history (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  -- ON DELETE RESTRICT (not CASCADE): a service request can never be hard-deleted while it
  -- still has history. In normal operation this never trips, because services_base rows are
  -- only ever soft-deleted (services_view_delete), never actually removed.
  "serviceId" uuid not null references public.services_base (id) on delete restrict,
  status text not null,
  note text,
  "changedBy" uuid references public.staff_profiles_base (id),
  "createdAt" timestamptz not null default pg_catalog.now()
);

create index if not exists service_history_service_idx on public.service_history ("serviceId");

-- Lives on services_base (the real table) so it fires for every insert/update path into it,
-- including the view's INSTEAD OF triggers. Does not fire for the soft-delete's own
-- "deletedAt"-only update, since that never changes status.
create or replace function public.log_service_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.service_history ("serviceId", status, "changedBy")
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function public.log_service_status_change() from public, anon, authenticated;

drop trigger if exists services_log_status on public.services_base;
create trigger services_log_status
  after insert or update on public.services_base
  for each row execute function public.log_service_status_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUDIT LOGS (privileged-action trail — written only by SECURITY DEFINER functions)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  "actorId" uuid references public.staff_profiles_base (id),
  action text not null,
  "targetTable" text,
  "targetId" text,
  details jsonb,
  "createdAt" timestamptz not null default pg_catalog.now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs ("actorId");

-- Admin-only, audited role/active change — the ONLY path that may write
-- staff_profiles_base.role/active. Writes straight to staff_profiles_base (not through the
-- `staff_profiles` view, whose UPDATE trigger never touches those columns at all). A
-- different admin must call this — admins cannot change their own role or active flag
-- (self-target is explicitly blocked).
create or replace function public.set_staff_role(p_target_id uuid, p_role text, p_active boolean)
returns public.staff_profiles_base
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.staff_profiles_base;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_target_id = auth.uid() then
    raise exception 'cannot change your own role or active status';
  end if;
  if p_role not in ('admin', 'stock', 'service') then
    raise exception 'invalid role: %', p_role;
  end if;

  update public.staff_profiles_base
    set role = p_role, active = p_active
    where id = p_target_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'staff profile % not found', p_target_id;
  end if;

  insert into public.audit_logs ("actorId", action, "targetTable", "targetId", details)
  values (auth.uid(), 'set_staff_role', 'staff_profiles', p_target_id::text,
          pg_catalog.jsonb_build_object('role', p_role, 'active', p_active));

  return v_row;
end;
$$;

revoke all on function public.set_staff_role(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.set_staff_role(uuid, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY + GRANTS — least-privilege, role-based
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.staff_profiles_base enable row level security;
alter table public.employees_base enable row level security;
alter table public.customers enable row level security;
alter table public.stocks_base enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.services_base enable row level security;
alter table public.service_history enable row level security;
alter table public.audit_logs enable row level security;

-- RLS on the _base tables is a defense-in-depth backstop (the primary control is "zero API
-- grants" below) in case grants are ever misconfigured later.
create policy "staff_profiles_base_admin_all" on public.staff_profiles_base
  for all using (public.is_admin()) with check (public.is_admin());
create policy "employees_base_admin_all" on public.employees_base
  for all using (public.is_admin()) with check (public.is_admin());
create policy "stocks_base_admin_stock_all" on public.stocks_base
  for all using (public.staff_role(auth.uid()) in ('admin', 'stock'))
  with check (public.staff_role(auth.uid()) in ('admin', 'stock'));
create policy "services_base_admin_service_all" on public.services_base
  for all using (public.staff_role(auth.uid()) in ('admin', 'service'))
  with check (public.staff_role(auth.uid()) in ('admin', 'service'));

-- customers: admin + service roles manage customer records (service requests link to them).
create policy "customers_admin_service" on public.customers
  for all using (public.staff_role(auth.uid()) in ('admin', 'service'))
  with check (public.staff_role(auth.uid()) in ('admin', 'service'));

-- inventory_movements: read-only for admin + stock; no insert/update/delete policy at all,
-- so client writes are always rejected — only adjust_stock() (SECURITY DEFINER) can insert.
create policy "inventory_movements_read" on public.inventory_movements
  for select using (public.staff_role(auth.uid()) in ('admin', 'stock'));

-- sales: admin + stock roles only (selling product is an inventory-adjacent operation).
create policy "sales_admin_stock" on public.sales
  for all using (public.staff_role(auth.uid()) in ('admin', 'stock'))
  with check (public.staff_role(auth.uid()) in ('admin', 'stock'));

-- service_history: read-only for admin + service; written only by the status-change trigger.
create policy "service_history_read" on public.service_history
  for select using (public.staff_role(auth.uid()) in ('admin', 'service'));

-- audit_logs: admin-only read; written only by SECURITY DEFINER functions.
create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.is_admin());

-- Base tables holding protected columns (role/active, quantity, salary, deletedAt) get ZERO
-- privilege grants to API roles — not even SELECT, and not even the (normally-empty-by-
-- default) PUBLIC pseudo-role. Every legitimate access path is one of the views below or a
-- SECURITY DEFINER function, both of which bypass grants/RLS on these tables by running as
-- the table owner.
revoke all on public.staff_profiles_base from public, authenticated, anon;
revoke all on public.employees_base from public, authenticated, anon;
revoke all on public.stocks_base from public, authenticated, anon;
revoke all on public.services_base from public, authenticated, anon;

-- The views are the real, grant-bearing surface. Row filtering is the view's own WHERE
-- clause; write filtering/column protection is the INSTEAD OF triggers (and, for
-- services.deletedAt, simply not being a column the view exposes) defined above — granting
-- here does not widen access beyond what those already enforce.
grant select, update on public.staff_profiles to authenticated; -- insert/delete intentionally omitted
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.stocks to authenticated;
grant select, insert, update, delete on public.services to authenticated;

-- customers/sales are plain RLS-protected tables (no "_base" + view split — nothing on them
-- is a protected column), but RLS alone is not sufficient: Postgres still requires a
-- table-level privilege grant before a policy is even consulted. Without these two grants,
-- `authenticated` would get "permission denied" on every customers/sales query regardless of
-- the RLS policies already defined above.
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.sales to authenticated;

-- Audit/history tables are read-only for API roles: grant SELECT so their existing RLS
-- policies (inventory_movements_read / service_history_read / audit_logs_admin_read) are
-- actually reachable, then explicitly revoke every write privilege so client
-- insert/update/delete always fails regardless of policy — the only writers are the
-- SECURITY DEFINER functions/triggers above, which bypass grants/RLS entirely by running as
-- the table owner.
grant select on public.inventory_movements to authenticated;
grant select on public.service_history to authenticated;
grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.inventory_movements from public, authenticated, anon;
revoke insert, update, delete on public.service_history from public, authenticated, anon;
revoke insert, update, delete on public.audit_logs from public, authenticated, anon;

-- This is a private admin tool — unauthenticated (anon) requests get zero access to any
-- business table or view, regardless of RLS. Supabase projects grant broad default
-- privileges to anon on public-schema tables/functions; this explicitly removes them. PUBLIC
-- is included too even though tables carry no implicit PUBLIC grant by default in Postgres —
-- making it explicit removes any doubt.
revoke all on public.staff_profiles from public, anon;
revoke all on public.employees from public, anon;
revoke all on public.customers from public, anon;
revoke all on public.stocks from public, anon;
revoke all on public.inventory_movements from public, anon;
revoke all on public.sales from public, anon;
revoke all on public.services from public, anon;
revoke all on public.service_history from public, anon;
revoke all on public.audit_logs from public, anon;
revoke all on all sequences in schema public from anon;

-- Forward-looking: new functions/tables created by future migrations in this schema no
-- longer default to anon-executable/anon-readable unless someone explicitly grants it —
-- closes the "including via default privileges" gap for anything added later, not just the
-- objects this file creates.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. FIRST-ADMIN BOOTSTRAP (one-time, SQL Editor / trusted DBA only)
-- ─────────────────────────────────────────────────────────────────────────────
-- A fresh project has no admin yet, so set_staff_role() (admin-only) can't create the first
-- one. This function is explicitly REVOKEd from PUBLIC, anon, AND authenticated — no API
-- role can ever execute it, by any path, including Supabase's default privilege grants (see
-- the ALTER DEFAULT PRIVILEGES statements above, which also cover functions created after
-- this one). The only way to invoke it is a SQL Editor session, which runs as a
-- superuser/table owner and can call any function regardless of grants. It also refuses to
-- run once an admin already exists, so it cannot be reused to mint additional admins later.
--
-- SECURE BOOTSTRAP STEPS (run manually, once, right after your own first signup):
--   1. Sign up normally through the app (creates a role='service', active=false row).
--   2. In the Supabase dashboard, go to Authentication > Users and copy YOUR user's UUID —
--      verify it is really your account (matching email) before proceeding.
--   3. In SQL Editor, run (replacing the placeholder with that verified UUID):
--        select public.bootstrap_first_admin('00000000-0000-0000-0000-000000000000'::uuid);
--   4. Confirm it worked:
--        select id, email, role, active from public.staff_profiles_base where role = 'admin';
--   5. Immediately remove the bootstrap path entirely so it can never be called again, even
--      from the SQL Editor:
--        drop function public.bootstrap_first_admin(uuid);
create or replace function public.bootstrap_first_admin(p_user_id uuid)
returns public.staff_profiles_base
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.staff_profiles_base;
begin
  if exists (select 1 from public.staff_profiles_base where role = 'admin' and active = true) then
    raise exception 'an admin already exists — use set_staff_role() instead';
  end if;

  update public.staff_profiles_base
    set role = 'admin', active = true
    where id = p_user_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'no staff profile found for user %', p_user_id;
  end if;

  insert into public.audit_logs ("actorId", action, "targetTable", "targetId", details)
  values (p_user_id, 'bootstrap_first_admin', 'staff_profiles', p_user_id::text,
          pg_catalog.jsonb_build_object('role', 'admin', 'active', true));

  return v_row;
end;
$$;

-- No API role, ever — PUBLIC, anon, and authenticated are all explicitly revoked. Only a
-- SQL Editor (superuser/owner) session can invoke this. Drop the function after use (above).
revoke all on function public.bootstrap_first_admin(uuid) from public, anon, authenticated;
