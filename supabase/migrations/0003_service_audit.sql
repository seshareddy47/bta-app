-- Historical records have unknown audit details; new writes are recorded by
-- the database using the authenticated staff profile.
alter table public.services_base
  add column "createdById" uuid references public.staff_profiles_base (id),
  add column "createdByName" text,
  add column "createdAt" timestamptz,
  add column "updatedById" uuid references public.staff_profiles_base (id),
  add column "updatedByName" text,
  add column "updatedAt" timestamptz;

create function public.services_set_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  if actor_id is null then
    return new;
  end if;

  select name into actor_name from public.staff_profiles_base
    where id = actor_id and active and role in ('admin', 'service');
  if actor_name is null or pg_catalog.btrim(actor_name) = '' then
    raise exception 'An active service staff profile with a name is required';
  end if;

  if tg_op = 'INSERT' then
    new."createdById" := actor_id;
    new."createdByName" := actor_name;
    new."createdAt" := pg_catalog.clock_timestamp();
    new."updatedById" := null;
    new."updatedByName" := null;
    new."updatedAt" := null;
  else
    new."createdById" := old."createdById";
    new."createdByName" := old."createdByName";
    new."createdAt" := old."createdAt";
    if new."deletedAt" is not distinct from old."deletedAt" then
      new."updatedById" := actor_id;
      new."updatedByName" := actor_name;
      new."updatedAt" := pg_catalog.clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.services_set_audit() from public, anon, authenticated;

create trigger services_set_audit_trg
  before insert or update on public.services_base
  for each row execute function public.services_set_audit();

create or replace view public.services as
  select
    id, "serialNo", "serviceNo", "complaintDate", "customerId", "customerName", mobile, area,
    "townVillage", "invoiceNumber", "invoiceDate", "modelNumber", "complaintType", "attendedDate",
    "technicianId", "technicianName", status,
    "technicianId" as "technicianId1", "technicianName" as "technicianName1",
    "technicianId2", "technicianName2", notes,
    "createdById", "createdByName", "createdAt", "updatedById", "updatedByName", "updatedAt"
  from public.services_base
  where public.staff_role(auth.uid()) in ('admin', 'service')
    and "deletedAt" is null;

notify pgrst, 'reload schema';
