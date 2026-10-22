import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Employee, Stock, Sale, ServiceRequest } from '../types';
import { generateId } from '../utils/helpers';
import { SEED_EMPLOYEES, SEED_STOCKS, SEED_SALES, SEED_SERVICES } from '../utils/seedData';
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

function loadOrSeed<T>(key: string, seed: T[]): T[] {
  const raw = localStorage.getItem(key);
  if (raw) return JSON.parse(raw) as T[];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function persist<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

const EMP_KEY = 'bta_employees';
const STK_KEY = 'bta_stocks';
const SALE_KEY = 'bta_sales';
const SVC_KEY = 'bta_services';

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() =>
    loadOrSeed(EMP_KEY, SEED_EMPLOYEES)
  );
  const [stocks, setStocks] = useState<Stock[]>(() =>
    loadOrSeed(STK_KEY, SEED_STOCKS)
  );
  const [sales, setSales] = useState<Sale[]>(() =>
    loadOrSeed(SALE_KEY, SEED_SALES)
  );
  const [services, setServices] = useState<ServiceRequest[]>(() =>
    loadOrSeed(SVC_KEY, SEED_SERVICES)
  );

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
        persist(SVC_KEY, merged_all);
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
    // Deferred so the sheet fetch (and its state updates) run after mount
    // instead of synchronously inside the effect body.
    void Promise.resolve().then(() => syncServicesFromSheet());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Employees ──────────────────────────────────────────────────────────────
  function addEmployee(emp: Employee) {
    const updated = [...employees, emp];
    setEmployees(updated);
    persist(EMP_KEY, updated);
  }
  function updateEmployee(emp: Employee) {
    const updated = employees.map((e) => (e.id === emp.id ? emp : e));
    setEmployees(updated);
    persist(EMP_KEY, updated);
  }
  function deleteEmployee(id: string) {
    const updated = employees.filter((e) => e.id !== id);
    setEmployees(updated);
    persist(EMP_KEY, updated);
  }

  // ── Stocks ─────────────────────────────────────────────────────────────────
  function addStock(stock: Stock) {
    const updated = [...stocks, stock];
    setStocks(updated);
    persist(STK_KEY, updated);
  }
  function updateStock(stock: Stock) {
    const updated = stocks.map((s) => (s.id === stock.id ? stock : s));
    setStocks(updated);
    persist(STK_KEY, updated);
  }
  function deleteStock(id: string) {
    const updated = stocks.filter((s) => s.id !== id);
    setStocks(updated);
    persist(STK_KEY, updated);
  }
  function decrementStock(productId: string, qty: number) {
    const updated = stocks.map((s) =>
      s.id === productId ? { ...s, quantity: Math.max(0, s.quantity - qty) } : s
    );
    setStocks(updated);
    persist(STK_KEY, updated);
  }

  // ── Sales ──────────────────────────────────────────────────────────────────
  function addSale(sale: Sale) {
    const updated = [...sales, sale];
    setSales(updated);
    persist(SALE_KEY, updated);
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
    const updated = sales.map((s) => (s.id === sale.id ? sale : s));
    setSales(updated);
    persist(SALE_KEY, updated);
  }
  function deleteSale(id: string) {
    const updated = sales.filter((s) => s.id !== id);
    setSales(updated);
    persist(SALE_KEY, updated);
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
    const updated = [...services, service];
    setServices(updated);
    persist(SVC_KEY, updated);
    pushServiceChange(pushServiceUpsert(service));
  }
  function updateService(service: ServiceRequest) {
    const updated = services.map((s) => (s.id === service.id ? service : s));
    setServices(updated);
    persist(SVC_KEY, updated);
    pushServiceChange(pushServiceUpsert(service));
  }
  function deleteService(id: string) {
    const service = services.find((s) => s.id === id);
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    persist(SVC_KEY, updated);
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
