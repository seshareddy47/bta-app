-- Verification tests for supabase/migrations/0001_init.sql
--
-- Parts A and B1-B5 are READ-ONLY / ROLLED-BACK (begin/rollback) — nothing persists. Part B6
-- deliberately COMMITS (it soft-deletes a test product and a test service request to prove
-- history survives) — only run it against disposable test data, not real records.
--
-- SETUP (one-time, before running the role-impersonation sections below):
--   1. Sign up 4 test accounts through the app UI:
--        admin-test@example.com, stock-test@example.com, service-test@example.com,
--        inactive-test@example.com
--   2. In Supabase Authentication > Users, copy each one's UUID.
--   3. As a real admin (after bootstrapping yourself — see migration section 11), run:
--        select set_staff_role('<stock-test-uuid>'::uuid, 'stock', true);
--        select set_staff_role('<service-test-uuid>'::uuid, 'service', true);
--        select set_staff_role('<admin-test-uuid>'::uuid, 'admin', true);
--      Leave inactive-test alone (stays role='service', active=false — that's the point).
--   4. Replace every placeholder below (search for "REPLACE:") with real values.
--   5. Create one test product via the app as admin/stock for "stock-test-product-uuid",
--      and one test service request via the app as admin/service for "some-service-uuid" /
--      "some-service-number" (its serviceNo) — B6 soft-deletes both.

-- ═════════════════════════════════════════════════════════════════════════════
-- PART A — static, read-only checks (safe to run anytime, no setup required)
-- ═════════════════════════════════════════════════════════════════════════════

-- A1. bootstrap_first_admin must be unreachable by every API role, in every form.
select
  has_function_privilege('anon', 'public.bootstrap_first_admin(uuid)', 'EXECUTE') as anon_can_bootstrap,          -- EXPECTED: false
  has_function_privilege('authenticated', 'public.bootstrap_first_admin(uuid)', 'EXECUTE') as authenticated_can_bootstrap; -- EXPECTED: false

-- A2. Only the four intentional RPCs are authenticated-executable; nothing is anon-executable.
select
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,                 -- EXPECTED: false for every row
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute -- EXPECTED: true only for staff_role/is_admin/adjust_stock/set_staff_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user', 'staff_role', 'is_admin', 'staff_profiles_view_update',
    'employees_view_insert', 'employees_view_update', 'employees_view_delete',
    'stocks_view_insert', 'stocks_view_update', 'stocks_view_delete', 'log_initial_stock',
    'adjust_stock', 'services_view_insert', 'services_view_update', 'services_view_delete',
    'log_service_status_change', 'set_staff_role', 'bootstrap_first_admin'
  )
order by p.proname;

-- A3. Ownership audit — every SECURITY DEFINER function should be owned by your trusted
-- project owner role (normally `postgres`), never anon/authenticated/public.
select p.proname, r.rolname as owner, p.prosecdef as is_security_definer
from pg_proc p
join pg_roles r on r.oid = p.proowner
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user', 'staff_role', 'is_admin', 'staff_profiles_view_update',
    'employees_view_insert', 'employees_view_update', 'employees_view_delete',
    'stocks_view_insert', 'stocks_view_update', 'stocks_view_delete', 'log_initial_stock',
    'adjust_stock', 'services_view_insert', 'services_view_update', 'services_view_delete',
    'log_service_status_change', 'set_staff_role', 'bootstrap_first_admin'
  )
order by p.proname;
-- EXPECTED: owner is the same trusted role for every row (your project's admin/owner role),
-- and is_security_definer = true for every row.

-- A4. RLS must be enabled on every base table (views don't need/can't have RLS directly).
select relname, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'staff_profiles_base', 'employees_base', 'customers', 'stocks_base',
    'inventory_movements', 'sales', 'services_base', 'service_history', 'audit_logs'
  )
order by relname;
-- EXPECTED: rls_enabled = true for every row.

-- A4b. The `services` view must not expose a deletedAt column at all (structural protection,
-- not just a trigger) — this query should return ZERO rows.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'services' and column_name = 'deletedAt';
-- EXPECTED: 0 rows

-- A5. _base tables must have zero grants to anon/authenticated (the view is the only surface).
select
  table_name,
  has_table_privilege('anon', table_name, 'SELECT') as anon_select,                  -- EXPECTED: false
  has_table_privilege('authenticated', table_name, 'SELECT') as authenticated_select -- EXPECTED: false
from (values ('public.staff_profiles_base'), ('public.employees_base'), ('public.stocks_base'), ('public.services_base')) as t(table_name);

-- A6. inventory_movements / service_history / audit_logs must never be writable by API roles.
select
  table_name,
  has_table_privilege('authenticated', table_name, 'INSERT') as authenticated_insert, -- EXPECTED: false
  has_table_privilege('authenticated', table_name, 'UPDATE') as authenticated_update, -- EXPECTED: false
  has_table_privilege('authenticated', table_name, 'DELETE') as authenticated_delete  -- EXPECTED: false
from (values
  ('public.inventory_movements'), ('public.service_history'), ('public.audit_logs')
) as t(table_name);

-- ═════════════════════════════════════════════════════════════════════════════
-- PART B — role-impersonation checks (transactional, always rolled back)
-- Uses Supabase's standard SQL Editor pattern for simulating auth.uid(): setting the
-- `request.jwt.claims` GUC and switching to the `anon`/`authenticated` Postgres role inside
-- a transaction, then rolling back so nothing persists regardless of outcome.
-- ═════════════════════════════════════════════════════════════════════════════

-- B1. Anonymous: must get zero rows/zero access everywhere.
begin;
  set local role anon;
  select count(*) as should_be_0 from public.stocks;      -- EXPECTED: permission denied or 0 rows
  select count(*) as should_be_0 from public.employees;    -- EXPECTED: permission denied or 0 rows
  select count(*) as should_be_0 from public.staff_profiles; -- EXPECTED: permission denied or 0 rows
rollback;

-- B2. Inactive / pending staff: minimum access — own profile only, nothing else.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: inactive-test-uuid"}';
  select * from public.staff_profiles; -- EXPECTED: exactly 1 row (their own), role/active visible but unchangeable
  select count(*) as should_be_0 from public.stocks;   -- EXPECTED: 0 rows
  select count(*) as should_be_0 from public.employees; -- EXPECTED: 0 rows
  select count(*) as should_be_0 from public.services; -- EXPECTED: 0 rows
  -- attempt a role self-escalation — must have zero effect on role/active:
  update public.staff_profiles set role = 'admin', active = true
    where id = 'REPLACE: inactive-test-uuid';
  select role, active from public.staff_profiles where id = 'REPLACE: inactive-test-uuid';
  -- EXPECTED: role = 'service', active = false (unchanged, despite the UPDATE "succeeding")
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, 1, 'should fail');
  -- EXPECTED: raises "not authorized to adjust stock"
rollback;

-- B3. Stock role: stocks/sales/inventory_movements yes; services/employee-salary no.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  select count(*) as should_be_gt_0 from public.stocks;              -- EXPECTED: > 0
  select count(*) as should_be_0 from public.services;                -- EXPECTED: 0
  select salary from public.employees limit 1;                       -- EXPECTED: null
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, -1, 'test deduction');
  -- EXPECTED: succeeds, returns the row with quantity - 1
  update public.stocks set quantity = 999 where id = 'REPLACE: stock-test-product-uuid'::uuid;
  select quantity from public.stocks where id = 'REPLACE: stock-test-product-uuid'::uuid;
  -- EXPECTED: quantity is whatever adjust_stock left it at, NOT 999 — the plain UPDATE's
  -- attempted quantity change had no effect.
  select public.set_staff_role('REPLACE: service-test-uuid'::uuid, 'admin', true);
  -- EXPECTED: raises "not authorized" (stock role is not admin)
rollback;

-- B4. Service role: services/customers yes; stocks/sales/employee-salary no.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: service-test-uuid"}';
  select count(*) as should_be_0 from public.stocks;   -- EXPECTED: 0
  select count(*) as should_be_0 from public.sales;    -- EXPECTED: 0
  select salary from public.employees limit 1;         -- EXPECTED: null
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, 1, 'should fail');
  -- EXPECTED: raises "not authorized to adjust stock"
rollback;

-- B5. Admin: full access everywhere, including real salary, but NOT their own role.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: admin-test-uuid"}';
  select count(*) as should_be_gt_0 from public.stocks;    -- EXPECTED: > 0
  select count(*) as should_be_gt_0 from public.services;  -- EXPECTED: > 0 (if any exist)
  select salary from public.employees limit 1;             -- EXPECTED: a real number, not null
  select public.set_staff_role('REPLACE: admin-test-uuid'::uuid, 'service', false);
  -- EXPECTED: raises "cannot change your own role or active status"
  select public.set_staff_role('REPLACE: stock-test-uuid'::uuid, 'service', true);
  -- EXPECTED: succeeds (admin changing someone else's role)
  select public.bootstrap_first_admin('REPLACE: inactive-test-uuid'::uuid);
  -- EXPECTED: raises "an admin already exists" (assuming admin-test was already promoted)
rollback;

-- B6. Soft delete preserves history (stocks + services); "deletedAt" lives only on the
-- _base table and is not reachable through either view at all.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  delete from public.stocks where id = 'REPLACE: stock-test-product-uuid'::uuid;
  select count(*) as should_be_0 from public.stocks where id = 'REPLACE: stock-test-product-uuid'::uuid;
commit;
select "deletedAt" from public.stocks_base where id = 'REPLACE: stock-test-product-uuid'::uuid;
-- EXPECTED: not null (soft-deleted, row still exists in stocks_base)
select count(*) as should_be_gt_0 from public.inventory_movements where "productId" = 'REPLACE: stock-test-product-uuid'::uuid;
-- EXPECTED: > 0 (history preserved despite the "delete")

begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: service-test-uuid"}';
  delete from public.services where id = 'REPLACE: some-service-uuid'::uuid;
  select count(*) as should_be_0 from public.services where id = 'REPLACE: some-service-uuid'::uuid;
commit;
select "deletedAt" from public.services_base where id = 'REPLACE: some-service-uuid'::uuid;
-- EXPECTED: not null (soft-deleted, row still exists in services_base)
select count(*) as should_be_gt_0 from public.service_history where "serviceId" = 'REPLACE: some-service-uuid'::uuid;
-- EXPECTED: > 0 (history preserved)

-- B7. services.deletedAt cannot be set, cleared, or targeted via INSERT/UPDATE through the
-- view at all — not an RLS/trigger denial, a structural one (the column doesn't exist there).
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: service-test-uuid"}';
  insert into public.services ("serialNo", "serviceNo", "complaintDate", "complaintType", "deletedAt")
  values ('SN-BYPASS', 'SRV-BYPASS', current_date, 'repair', now());
rollback;
-- EXPECTED: raises "column \"deletedAt\" of relation \"services\" does not exist"
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: service-test-uuid"}';
  update public.services set "deletedAt" = now() where id = 'REPLACE: some-other-active-service-uuid'::uuid;
rollback;
-- EXPECTED: same "column does not exist" error

-- B8. adjust_stock() input validation and atomicity.
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, 0, 'zero delta');
rollback;
-- EXPECTED: raises "delta must be a non-null, non-zero integer (got 0)"
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, null, 'null delta');
rollback;
-- EXPECTED: raises "delta must be a non-null, non-zero integer (got <NULL>)"
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, -1, '   ');
rollback;
-- EXPECTED: raises "reason must not be null or blank"
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub": "REPLACE: stock-test-uuid"}';
  select count(*) as movements_before from public.inventory_movements where "productId" = 'REPLACE: stock-test-product-uuid'::uuid;
  select public.adjust_stock('REPLACE: stock-test-product-uuid'::uuid, -999999, 'overdraw attempt');
rollback;
-- EXPECTED: raises "insufficient stock: ... would be negative"; a follow-up count (outside
-- this rolled-back transaction) of inventory_movements for this product must be unchanged —
-- the failed attempt must not have logged a movement (atomicity).
