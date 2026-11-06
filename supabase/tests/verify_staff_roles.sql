-- Run against a migrated database with an active admin. Test accounts and data
-- are rolled back; avoid running concurrently with account administration.
begin;
do $$
declare
  admin_id uuid;
  test_id uuid := pg_catalog.gen_random_uuid();
  test_role text;
  test_active boolean;
begin
  select id into strict admin_id from public.staff_profiles_base
    where role = 'admin' and active limit 1;
  insert into auth.users (id, email, raw_user_meta_data)
    values (test_id, test_id::text || '@example.invalid',
            '{"name":"Role test","role":"admin"}'::jsonb);
  select role, active into strict test_role, test_active
    from public.staff_profiles_base where id = test_id;
  if test_role <> 'service' or test_active then
    raise exception 'Signup did not create an inactive service account';
  end if;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  begin
    perform public.set_staff_role(test_id, 'stock', true);
    raise exception 'Stock role was accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid role: stock' then raise; end if;
  end;
  perform public.set_staff_role(test_id, 'service', true);
  perform set_config('request.jwt.claim.sub', test_id::text, true);
end;
$$;
set local role authenticated;
do $$
begin
  if exists (select 1 from public.sales) or exists (select 1 from public.stocks) then
    raise exception 'Service account can see sales or stock';
  end if;
  perform count(*) from public.services;
  begin
    perform public.set_staff_role(auth.uid(), 'admin', true);
    raise exception 'Service account could change a role';
  exception when raise_exception then
    if sqlerrm <> 'not authorized' then raise; end if;
  end;
end;
$$;
rollback;
