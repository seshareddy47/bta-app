import type { SupabaseClient } from '@supabase/supabase-js';
import type { Employee, ServiceRequest } from '../types';

export type ServiceTechnician = Pick<Employee, 'id' | 'name' | 'status'>;

export function toServicePayload(service: ServiceRequest): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...service,
    serviceNo: service.serviceNo || null,
    area: service.area || null,
    modelNumber: service.modelNumber || null,
    technicianId1: service.technicianId1 || null,
    technicianId2: service.technicianId2 || null,
    invoiceDate: service.invoiceDate || null,
    attendedDate: service.attendedDate || null,
    notes: service.notes || null,
  };
  delete payload.serialNo;
  delete payload.createdById;
  delete payload.createdByName;
  delete payload.createdAt;
  delete payload.updatedById;
  delete payload.updatedByName;
  delete payload.updatedAt;
  return payload;
}

export function technicianOptions(
  technicians: ServiceTechnician[], assignedId: string | null | undefined,
  assignedName: string | null | undefined, excludedId: string,
): { id: string; label: string }[] {
  const options = technicians
    .filter((tech) => tech.id !== excludedId && (tech.status === 'active' || tech.id === assignedId))
    .map((tech) => ({ id: tech.id, label: `${tech.name}${tech.status === 'inactive' ? ' (Inactive)' : ''}` }));
  if (assignedId && assignedId !== excludedId && !technicians.some((tech) => tech.id === assignedId)) {
    options.unshift({ id: assignedId, label: `${assignedName || 'Technician'} (Unavailable)` });
  }
  return options;
}

export function technicianName(
  id: string, assignedId: string | null | undefined, assignedName: string | null | undefined,
  technicians: ServiceTechnician[],
): string {
  if (id === (assignedId ?? '') && assignedName != null) return assignedName;
  return technicians.find((tech) => tech.id === id)?.name ?? '';
}

export async function loadServiceData(client: SupabaseClient): Promise<{
  services?: ServiceRequest[];
  technicians?: ServiceTechnician[];
  error?: string;
}> {
  const [services, technicians] = await Promise.allSettled([
    client.from('services').select('*'),
    client.from('employees').select('id,name,status').eq('role', 'technician'),
  ]);
  const errors: string[] = [];
  const result: { services?: ServiceRequest[]; technicians?: ServiceTechnician[]; error?: string } = {};
  if (services.status === 'rejected') errors.push(`Services: ${errorMessage(services.reason)}`);
  else if (services.value.error) errors.push(`Services: ${services.value.error.message}`);
  else result.services = services.value.data as ServiceRequest[];
  if (technicians.status === 'rejected') errors.push(`Technicians: ${errorMessage(technicians.reason)}`);
  else if (technicians.value.error) errors.push(`Technicians: ${technicians.value.error.message}`);
  else result.technicians = technicians.value.data as ServiceTechnician[];
  if (errors.length) result.error = errors.join(' ');
  return result;
}

export async function deleteServiceRecord(client: SupabaseClient, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await client.from('services').delete().eq('id', id).select('id').maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Service not found or no longer accessible' };
    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Service request failed';
}
