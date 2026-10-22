import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Employee, Stock, Sale, ServiceRequest } from '../types';
import { generateId } from '../utils/helpers';
import { SEED_EMPLOYEES, SEED_STOCKS, SEED_SALES, SEED_SERVICES } from '../utils/seedData';
import { supabase } from '../lib/supabaseClient';
import {
  fetchServiceRowsFromSheet,
  isSheetsSyncEnabled,
  pushServiceDelete,
  pushServiceUpsert,
  sheetRowToService,
} from '../utils/googleSheetsSync';

interface DataContextValue {
  // Employees
  employees: Employee[];
  addEmployee: (emp: Employee) => void;
  updateEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;
  // Stocks
  stocks: Stock[];
  addStock: (stock: Stock) => void;
  updateStock: (stock: Stock) => void;
  deleteStock: (id: string) => void;
  decrementStock: (productId: string, qty: number) => void;
  // Sales
  sales: Sale[];
  addSale: (sale: Sale) => void;
  updateSale: (sale: Sale) => void;
  deleteSale: (id: string) => void;
  // Services
  services: ServiceRequest[];
  addService: (service: ServiceRequest) => void;
  updateService: (service: ServiceRequest) => void;
  deleteService: (id: string) => void;
  // Services <-> Google Sheet sync
  servicesSyncEnabled: boolean;
  servicesSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  servicesSyncError: string | null;
  servicesLastSyncedAt: string | null;
  syncServicesFromSheet: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

// Fetches a table's rows; seeds it with demo data the first time a fresh Supabase project is empty.
async function loadOrSeed<T>(table: string, seed: T[]): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  if (data && data.length > 0) return data as T[];
  if (seed.length > 0) {
    const { error: insertError } = await supabase.from(table).insert(seed as Record<string, unknown>[]);
    if (insertError) throw insertError;
  }
  return seed;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<ServiceRequest[]>([]);

  // ── Services <-> Google Sheet sync ──────────────────────────────────────────
  const [servicesSyncStatus, setServicesSyncStatus] =
    useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [servicesSyncError, setServicesSyncError] = useState<string | null>(null);
  const [servicesLastSyncedAt, setServicesLastSyncedAt] = useState<string | null>(null);

  async function syncServicesFromSheet() {
    if (!isSheetsSyncEnabled()) return;
    setServicesSyncStatus('syncing');
    setServicesSyncError(null);
    try {
      const rows = await fetchServiceRowsFromSheet();
      setServices((prev) => {
        const byServiceNo = new Map(prev.map((s) => [s.serviceNo, s]));
        const merged = rows.map((row) => {
          const existing = byServiceNo.get(row['Service No']);
          const service = sheetRowToService(row, existing?.id);
          const technician = employees.find(
            (emp) => emp.name.trim().toLowerCase() === service.technicianName.trim().toLowerCase()
          );
          service.technicianId = technician?.id ?? existing?.technicianId ?? '';
          byServiceNo.delete(row['Service No']);
          return service;
        });
        // Keep local-only records that haven't made it to the sheet yet.
        const merged_all = [...merged, ...byServiceNo.values()];
        void supabase.from('services').upsert(merged_all);
        return merged_all;
      });
      setServicesSyncStatus('synced');
      setServicesLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setServicesSyncStatus('error');
      setServicesSyncError(err instanceof Error ? err.message : 'Sync failed');
    }
  }

  useEffect(() => {
    // Deferred so the Supabase/sheet fetches (and their state updates) run after mount
    // instead of synchronously inside the effect body.
    void Promise.resolve().then(async () => {
      const [emp, stk, sal, svc] = await Promise.all([
        loadOrSeed<Employee>('employees', SEED_EMPLOYEES),
        loadOrSeed<Stock>('stocks', SEED_STOCKS),
        loadOrSeed<Sale>('sales', SEED_SALES),
        loadOrSeed<ServiceRequest>('services', SEED_SERVICES),
      ]);
      setEmployees(emp);
      setStocks(stk);
      setSales(sal);
      setServices(svc);
      void syncServicesFromSheet();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Employees ──────────────────────────────────────────────────────────────
  function addEmployee(emp: Employee) {
    setEmployees((prev) => [...prev, emp]);
    void supabase.from('employees').insert(emp).then(({ error }) => {
      if (error) setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    });
  }
  function updateEmployee(emp: Employee) {
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    void supabase.from('employees').update(emp).eq('id', emp.id);
  }
  function deleteEmployee(id: string) {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    void supabase.from('employees').delete().eq('id', id);
  }

  // ── Stocks ─────────────────────────────────────────────────────────────────
  function addStock(stock: Stock) {
    setStocks((prev) => [...prev, stock]);
    void supabase.from('stocks').insert(stock).then(({ error }) => {
      if (error) setStocks((prev) => prev.filter((s) => s.id !== stock.id));
    });
  }
  function updateStock(stock: Stock) {
    setStocks((prev) => prev.map((s) => (s.id === stock.id ? stock : s)));
    void supabase.from('stocks').update(stock).eq('id', stock.id);
  }
  function deleteStock(id: string) {
    setStocks((prev) => prev.filter((s) => s.id !== id));
    void supabase.from('stocks').delete().eq('id', id);
  }
  function decrementStock(productId: string, qty: number) {
    setStocks((prev) => {
      const updated = prev.map((s) =>
        s.id === productId ? { ...s, quantity: Math.max(0, s.quantity - qty) } : s
      );
      const next = updated.find((s) => s.id === productId);
      if (next) void supabase.from('stocks').update({ quantity: next.quantity }).eq('id', productId);
      return updated;
    });
  }

  // ── Sales ──────────────────────────────────────────────────────────────────
  function addSale(sale: Sale) {
    setSales((prev) => [...prev, sale]);
    void supabase.from('sales').insert(sale).then(({ error }) => {
      if (error) setSales((prev) => prev.filter((s) => s.id !== sale.id));
    });
    if (sale.status === 'completed') {
      if (sale.items?.length) {
        sale.items.forEach((item) => {
          const stock = stocks.find((s) => s.sku === item.sku);
          if (stock) decrementStock(stock.id, item.quantity);
        });
      } else {
        decrementStock(sale.productId, sale.quantity);
      }
    }
  }
  function updateSale(sale: Sale) {
    setSales((prev) => prev.map((s) => (s.id === sale.id ? sale : s)));
    void supabase.from('sales').update(sale).eq('id', sale.id);
  }
  function deleteSale(id: string) {
    setSales((prev) => prev.filter((s) => s.id !== id));
    void supabase.from('sales').delete().eq('id', id);
  }

  // ── Services ───────────────────────────────────────────────────────────────
  function pushServiceChange(promise: Promise<void>) {
    if (!isSheetsSyncEnabled()) return;
    promise
      .then(() => {
        setServicesSyncStatus('synced');
        setServicesLastSyncedAt(new Date().toISOString());
      })
      .catch((err) => {
        setServicesSyncStatus('error');
        setServicesSyncError(err instanceof Error ? err.message : 'Sync failed');
      });
  }
  function addService(service: ServiceRequest) {
    setServices((prev) => [...prev, service]);
    void supabase.from('services').insert(service).then(({ error }) => {
      if (error) setServices((prev) => prev.filter((s) => s.id !== service.id));
    });
    pushServiceChange(pushServiceUpsert(service));
  }
  function updateService(service: ServiceRequest) {
    setServices((prev) => prev.map((s) => (s.id === service.id ? service : s)));
    void supabase.from('services').update(service).eq('id', service.id);
    pushServiceChange(pushServiceUpsert(service));
  }
  function deleteService(id: string) {
    const service = services.find((s) => s.id === id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    void supabase.from('services').delete().eq('id', id);
    if (service) pushServiceChange(pushServiceDelete(service.serviceNo));
  }

  return (
    <DataContext.Provider
      value={{
        employees, addEmployee, updateEmployee, deleteEmployee,
        stocks, addStock, updateStock, deleteStock, decrementStock,
        sales, addSale, updateSale, deleteSale,
        services, addService, updateService, deleteService,
        servicesSyncEnabled: isSheetsSyncEnabled(),
        servicesSyncStatus, servicesSyncError, servicesLastSyncedAt, syncServicesFromSheet,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export { generateId };

