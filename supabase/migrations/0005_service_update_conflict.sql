-- Reject concurrent edits rather than overwriting a change made after the view
-- row was read. The audit trigger sets updatedAt on each successful update.
create or replace function public.services_view_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role(auth.uid()) is null or public.staff_role(auth.uid()) not in ('admin', 'service') then
    raise exception 'not authorized to update this service request';
  end if;
  if new."serialNo" is distinct from old."serialNo" then
    raise exception 'serial number cannot be changed';
  end if;

  update public.services_base set
    "serviceNo" = nullif(new."serviceNo", ''),
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
    "technicianId" = new."technicianId1",
    "technicianName" = coalesce(new."technicianName1", ''),
    "technicianId2" = new."technicianId2",
    "technicianName2" = coalesce(new."technicianName2", ''),
    status = new.status,
    notes = new.notes
  where id = old.id and "deletedAt" is null
    and "updatedAt" is not distinct from old."updatedAt";

  if not found then
    raise exception 'Service changed or is no longer accessible. Refresh and try again.';
  end if;
  new."technicianId" := new."technicianId1";
  new."technicianName" := new."technicianName1";
  return new;
end;
$$;
