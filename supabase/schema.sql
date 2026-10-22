-- Blue Star AC Shop Manager — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once per project.
-- Column names are camelCase (quoted) to match the TypeScript types in src/types/index.ts 1:1.

-- ─── Profiles (extends auth.users with app-specific fields) ─────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'sales')),
  "createdAt" timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- Expects name/role to be passed as signUp(..., { data: { name, role } }) metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'sales')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Employees ───────────────────────────────────────────────────────────────
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  "empId" text unique not null,
  name text not null,
  role text not null check (role in ('manager', 'sales', 'technician', 'admin')),
  phone text not null,
  email text not null,
  "joinDate" date not null,
  salary numeric not null default 0,
  status text not null check (status in ('active', 'inactive')) default 'active'
);

-- ─── Stocks ──────────────────────────────────────────────────────────────────
create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  "productName" text not null,
  category text not null check (category in ('split-ac', 'window-ac', 'cassette-ac', 'tower-ac')),
  tonnage text not null check (tonnage in ('1T', '1.5T', '2T')),
  "starRating" smallint not null check ("starRating" in (3, 4, 5)),
  "modelNumber" text not null,
  price numeric not null default 0,
  quantity integer not null default 0,
  "minStock" integer not null default 0,
  location text not null default '',
  "lastUpdated" timestamptz not null default now()
);

-- ─── Sales ───────────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  "invoiceNumber" text unique not null,
  date date not null,
  time text not null,
  "paymentMethod" text not null,
  "employeeId" text not null default '',
  "employeeName" text not null default '',
  "storeLocation" text not null default '',
  "gstApplicable" boolean not null default false,
  status text not null check (status in ('completed', 'pending', 'cancelled')) default 'pending',
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
  "totalAmount" numeric not null default 0,
  "amountPaid" numeric not null default 0,
  "balanceDue" numeric not null default 0,
  "dueDate" date,
  "installationRequired" boolean not null default false,
  "installationDate" date,
  "assignedTechnicianId" text not null default '',
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

-- ─── Service requests ────────────────────────────────────────────────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  "serialNo" text not null default '',
  "serviceNo" text unique not null,
  "complaintDate" date not null,
  "customerName" text not null default '',
  mobile text not null default '',
  area text not null default '',
  "townVillage" text not null default '',
  "invoiceNumber" text not null default '',
  "invoiceDate" date,
  "modelNumber" text not null default '',
  "complaintType" text not null,
  "attendedDate" date,
  "technicianId" text not null default '',
  "technicianName" text not null default '',
  status text not null check (status in ('open', 'in-progress', 'completed', 'cancelled')) default 'open'
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Single-tenant internal tool: any signed-in user can read/write all rows.
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.stocks enable row level security;
alter table public.sales enable row level security;
alter table public.services enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

create policy "employees: authenticated full access" on public.employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "stocks: authenticated full access" on public.stocks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "sales: authenticated full access" on public.sales
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "services: authenticated full access" on public.services
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
