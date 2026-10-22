// Sync helper for the Service tab <-> Google Sheet (via a Google Apps Script Web App).
// See google-apps-script/README.md for deployment instructions.
import type { ComplaintType, ServiceRequest, ServiceStatus } from '../types';

const WEB_APP_URL = import.meta.env.VITE_SHEETS_WEB_APP_URL;

export function isSheetsSyncEnabled(): boolean {
  return Boolean(WEB_APP_URL);
}

const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  installation: 'Installation',
  'gas-refill': 'Gas Refill',
  repair: 'Repair',
  maintenance: 'Maintenance',
  'noise-issue': 'Noise Issue',
  'water-leakage': 'Water Leakage',
  'remote-issue': 'Remote Issue',
  other: 'Other',
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function labelToComplaintType(label: string): ComplaintType {
  const norm = label.trim().toLowerCase();
  const match = (Object.keys(COMPLAINT_TYPE_LABELS) as ComplaintType[]).find(
    (key) => COMPLAINT_TYPE_LABELS[key].toLowerCase() === norm || key === norm
  );
  return match ?? 'other';
}

function labelToStatus(label: string): ServiceStatus {
  const norm = label.trim().toLowerCase();
  const match = (Object.keys(STATUS_LABELS) as ServiceStatus[]).find(
    (key) => STATUS_LABELS[key].toLowerCase() === norm || key === norm
  );
  return match ?? 'open';
}

// Column headers must match the sheet's header row exactly.
export type SheetRow = Record<string, string>;

export function serviceToSheetRow(service: ServiceRequest): SheetRow {
  return {
    'Serial No': service.serialNo,
    'Service No': service.serviceNo,
    'Complaint Date': service.complaintDate,
    'Customer Name': service.customerName,
    Mobile: service.mobile,
    Area: service.area,
    'Town/Village': service.townVillage,
    'Invoice Number': service.invoiceNumber,
    'Invoice Date': service.invoiceDate,
    'Model Number': service.modelNumber,
    'Type of Complaint': COMPLAINT_TYPE_LABELS[service.complaintType],
    'Attended Date': service.attendedDate,
    Technician: service.technicianName,
    Status: STATUS_LABELS[service.status],
  };
}

// technicianId is intentionally left blank here — the sheet only stores the technician's
// name, so the caller (DataContext) resolves it against the employees list.
export function sheetRowToService(row: SheetRow, existingId?: string): ServiceRequest {
  return {
    id: existingId ?? crypto.randomUUID(),
    serialNo: row['Serial No'] ?? '',
    serviceNo: row['Service No'] ?? '',
    complaintDate: row['Complaint Date'] ?? '',
    customerName: row['Customer Name'] ?? '',
    mobile: row['Mobile'] ?? '',
    area: row['Area'] ?? '',
    townVillage: row['Town/Village'] ?? '',
    invoiceNumber: row['Invoice Number'] ?? '',
    invoiceDate: row['Invoice Date'] ?? '',
    modelNumber: row['Model Number'] ?? '',
    complaintType: labelToComplaintType(row['Type of Complaint'] ?? ''),
    attendedDate: row['Attended Date'] ?? '',
    technicianId: '',
    technicianName: row['Technician'] ?? '',
    status: labelToStatus(row['Status'] ?? ''),
  };
}

export async function fetchServiceRowsFromSheet(): Promise<SheetRow[]> {
  if (!WEB_APP_URL) throw new Error('Google Sheets sync is not configured');
  const res = await fetch(`${WEB_APP_URL}?action=list`);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Sheet fetch failed');
  return data.rows as SheetRow[];
}

async function postToSheet(body: Record<string, unknown>): Promise<void> {
  if (!WEB_APP_URL) throw new Error('Google Sheets sync is not configured');
  // Content-Type text/plain keeps this a "simple request" so the Apps Script
  // web app (which doesn't handle CORS preflight/OPTIONS) can receive it.
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sheet update failed: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? 'Sheet update failed');
}

export function pushServiceUpsert(service: ServiceRequest): Promise<void> {
  return postToSheet({ action: 'upsert', row: serviceToSheetRow(service) });
}

export function pushServiceDelete(serviceNo: string): Promise<void> {
  return postToSheet({ action: 'delete', serviceNo });
}
