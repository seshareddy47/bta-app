import type { Sale, AcCategory, AcTonnage, StarRating } from '../types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateEmpId(currentCount: number): string {
  return `EMP${String(currentCount + 1).padStart(3, '0')}`;
}

export function generateServiceNo(currentCount: number): string {
  return `SRV${String(currentCount + 1).padStart(4, '0')}`;
}

export function generateSku(
  category: AcCategory,
  tonnage: AcTonnage,
  starRating: StarRating
): string {
  const catCode = {
    'split-ac': 'SP',
    'window-ac': 'WN',
    'cassette-ac': 'CS',
    'tower-ac': 'TW',
  }[category];
  const tonCode = tonnage.replace('.', '').replace('T', '');
  return `BS-${catCode}-${tonCode}-${starRating}S`;
}

export function formatRupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function aggregateSalesByMonth(
  sales: Sale[]
): { month: string; revenue: number; units: number }[] {
  const map: Record<string, { month: string; revenue: number; units: number }> = {};
  sales.forEach((s) => {
    const key = s.date.slice(0, 7);
    const label = new Date(s.date + '-01').toLocaleString('en-IN', {
      month: 'short',
      year: '2-digit',
    });
    if (!map[key]) map[key] = { month: label, revenue: 0, units: 0 };
    if (s.status === 'completed') {
      map[key].revenue += s.totalAmount;
      map[key].units += s.quantity;
    }
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const pad = (n: number, d = 2) => String(n).padStart(d, '0');
  return `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function detectSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 4 && month <= 6) return 'Summer';
  if (month >= 7 && month <= 9) return 'Monsoon';
  return 'Winter';
}
