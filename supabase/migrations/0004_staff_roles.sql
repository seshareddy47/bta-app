-- Refuse to change existing accounts automatically; an administrator must
-- decide how to reassign any legacy stock accounts before this migration.
lock table public.staff_profiles_base in access exclusive mode;

do $$
begin
  if exists (select 1 from public.staff_profiles_base where role = 'stock') then
    raise exception 'Reassign existing stock accounts before applying this migration';
  end if;
end;
$$;

alter table public.staff_profiles_base drop constraint staff_profiles_base_role_check;
alter table public.staff_profiles_base add constraint staff_profiles_base_role_check
  check (role in ('admin', 'service'));

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
  if p_role is null or p_role not in ('admin', 'service') then
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

notify pgrst, 'reload schema';
