-- Run against a migrated database with at least one active admin. Rolls back
-- service writes; PostgreSQL sequences may still advance.
begin;
do $$
declare admin_id uuid;
begin
  select id into strict admin_id from public.staff_profiles_base
    where role = 'admin' and active and nullif(btrim(name), '') is not null limit 1;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  service_id uuid;
  recorded public.services%rowtype;
  creator_time timestamptz;
begin
  insert into public.services ("complaintDate", "customerName", mobile, "townVillage",
    "complaintType", "createdByName", "updatedByName")
  values ('2026-01-01', 'Test', '9999999999', 'Test', 'repair', 'forged', 'forged')
  returning id into service_id;
  select * into strict recorded from public.services where id = service_id;
  if recorded."createdById" is distinct from auth.uid()
    or recorded."createdByName" is null or recorded."createdByName" = 'forged'
    or recorded."createdAt" is null or recorded."updatedAt" is not null
    or recorded."updatedByName" is not null then
    raise exception 'Created-by audit verification failed';
  end if;
  creator_time := recorded."createdAt";
  update public.services set notes = 'Updated', "createdByName" = 'forged',
    "updatedByName" = 'forged' where id = service_id;
  select * into strict recorded from public.services where id = service_id;
  if recorded."createdByName" = 'forged' or recorded."createdAt" is distinct from creator_time
    or recorded."updatedById" is distinct from auth.uid()
    or recorded."updatedByName" is null or recorded."updatedByName" = 'forged'
    or recorded."updatedAt" is null or recorded.notes <> 'Updated' then
    raise exception 'Updated-by audit verification failed';
  end if;
end;
$$;
rollback;
