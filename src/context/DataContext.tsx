import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Employee, Stock, Sale, ServiceRequest } from '../types';
import { generateId } from '../utils/helpers';
import { SEED_EMPLOYEES, SEED_STOCKS, SEED_SALES } from '../utils/seedData';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { deleteServiceRecord, loadServiceData, toServicePayload, type ServiceTechnician } from '../utils/serviceOperations';

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
  serviceTechnicians: ServiceTechnician[];
  servicesLoading: boolean;
  servicesError: string | null;
  refreshServices: () => Promise<void>;
  addService: (service: ServiceRequest) => Promise<{ success: boolean; error?: string }>;
  updateService: (service: ServiceRequest) => Promise<{ success: boolean; error?: string }>;
  deleteService: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DataContext = createContext<DataContextValue | null>(null);

// Fetches a table's rows; seeds it with demo data the first time a fresh Supabase project is empty.
// Seed rows use short, readable placeholder ids ("emp-1", "svc-1", ...), but every table's real
// primary key is a Postgres `uuid` column — inserting the placeholder as-is fails with "invalid
// input syntax for type uuid". So each row gets a real uuid generated here; callers that need to
// fix up cross-references to another seeded table's placeholder ids (e.g. SEED_SALES.employeeId
// pointing at a SEED_EMPLOYEES id) must build that mapping themselves from the returned rows —
// this function can't do it generically, since it's just as likely the referenced table was
// already seeded in an earlier run (and so never goes through the fresh-id-generation branch at
// all). `toPayload` lets callers additionally sanitize the insert body only (not the rows kept in
// local state) — e.g. to turn a blank optional uuid/date field into null, same as a manual add.
async function loadOrSeed<T extends { id: string }>(
  table: string,
  seed: T[],
  toPayload: (row: T) => Record<string, unknown> = (row) => row as unknown as Record<string, unknown>
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  if (data && data.length > 0) return data as T[];
  if (seed.length === 0) return seed;
  const rows = seed.map((row) => ({ ...row, id: generateId() }));
  // .select() so DB-generated/defaulted columns (e.g. services.serialNo) come back with their
  // real stored value instead of the pre-insert guess in `rows`.
  const { data: inserted, error: insertError } = await supabase.from(table).insert(rows.map(toPayload)).select();
  if (insertError) throw insertError;
  return (inserted as T[] | null) ?? rows;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [serviceTechnicians, setServiceTechnicians] = useState<ServiceTechnician[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const serviceRequest = useRef(0);
  const userId = user?.id;

  const refreshServices = useCallback(async () => {
    if (!isAuthenticated || !userId) return;
    const request = ++serviceRequest.current;
    setServicesLoading(true);
    setServicesError(null);
    try {
      const result = await loadServiceData(supabase);
      if (request !== serviceRequest.current) return;
      if (result.services) setServices(result.services);
      if (result.technicians) setServiceTechnicians(result.technicians);
      if (result.error) setServicesError(result.error);
    } catch (err) {
      if (request === serviceRequest.current) {
        setServicesError(err instanceof Error ? err.message : 'Failed to load service data');
      }
    } finally {
      if (request === serviceRequest.current) setServicesLoading(false);
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setServices([]);
      setServiceTechnicians([]);
      setServicesError(null);
      setServicesLoading(false);
      if (isAuthenticated && userId) void refreshServices();
    });
    return () => { cancelled = true; serviceRequest.current += 1; };
  }, [authLoading, isAuthenticated, userId, refreshServices]);

  useEffect(() => {
    let cancelled = false;
    // Every table is locked down to the `authenticated` Postgres role (see
    // supabase/migrations/0001_init.sql) — fetching while logged out always 401s. Previously
    // this ran unconditionally on mount (including on /login, before any session exists) and
    // the rejection went uncaught, so gate on auth state and handle errors explicitly.
    if (authLoading) return;
    // Deferred so the Supabase/sheet fetches (and their state updates) run after mount
    // instead of synchronously inside the effect body.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setEmployees([]);
      setStocks([]);
      setSales([]);
      if (!isAuthenticated || !user) return;
      try {
        if (user.role === 'service') {
          return;
        }
        const [emp, stk] = await Promise.all([
          loadOrSeed<Employee>('employees', SEED_EMPLOYEES),
          loadOrSeed<Stock>('stocks', SEED_STOCKS),
        ]);
        // SEED_SALES references SEED_EMPLOYEES by its placeholder id ("emp-2"),
        // but `emp`'s real ids may have been generated just now OR already existed from an
        // earlier seed run — either way, match on the stable `empId` business key (e.g.
        // "EMP002") to build a reliable placeholder-id -> real-uuid map, since
        // employeeId/assignedTechnicianId are uuid foreign keys.
        const empIdMap: Record<string, string> = {};
        SEED_EMPLOYEES.forEach((seedEmp) => {
          const match = emp.find((e) => e.empId === seedEmp.empId);
          if (match) empIdMap[seedEmp.id] = match.id;
        });
        const remapEmployeeRef = (id: string) => empIdMap[id] ?? id;
        const remappedSales = SEED_SALES.map((s) => ({
          ...s,
          employeeId: remapEmployeeRef(s.employeeId),
          assignedTechnicianId: remapEmployeeRef(s.assignedTechnicianId),
        }));
        const sal = await loadOrSeed<Sale>('sales', remappedSales, toSalePayload);
        if (cancelled) return;
        setEmployees(emp);
        setStocks(stk);
        setSales(sal);
      } catch (err) {
        console.error('Failed to load initial data from Supabase:', err);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, user?.id, user?.role]);

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
  // Routes through the adjust_stock() RPC so the DB enforces the quantity >= 0 constraint
  // and records an auditable inventory_movements row (see supabase/migrations/0001_init.sql).
  async function decrementStock(productId: string, qty: number) {
    const { data, error } = await supabase.rpc('adjust_stock', {
      p_product_id: productId,
      p_delta: -qty,
      p_reason: 'Sale completed',
    });
    if (error) {
      console.error('Stock adjustment failed:', error.message);
      return;
    }
    if (data) setStocks((prev) => prev.map((s) => (s.id === productId ? (data as Stock) : s)));
  }

  // ── Sales ──────────────────────────────────────────────────────────────────
  // Mirrors toServicePayload() above: assignedTechnicianId (uuid) and dueDate/installationDate
  // (date) are optional in the form and default to '', which Postgres rejects for these types.
  function toSalePayload(sale: Sale) {
    return {
      ...sale,
      assignedTechnicianId: sale.assignedTechnicianId || null,
      dueDate: sale.dueDate || null,
      installationDate: sale.installationDate || null,
    };
  }
  function addSale(sale: Sale) {
    setSales((prev) => [...prev, sale]);
    void supabase.from('sales').insert(toSalePayload(sale)).then(({ error }) => {
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
    void supabase.from('sales').update(toSalePayload(sale)).eq('id', sale.id);
  }
  function deleteSale(id: string) {
    setSales((prev) => prev.filter((s) => s.id !== id));
    void supabase.from('sales').delete().eq('id', id);
  }

  // ── Services ───────────────────────────────────────────────────────────────
  async function addService(service: ServiceRequest): Promise<{ success: boolean; error?: string }> {
    let saved: ServiceRequest | undefined;
    try {
      const { data, error } = await supabase.from('services').insert(toServicePayload(service)).select().single();
      if (error) return { success: false, error: error.message };
      saved = data as ServiceRequest;
      const { data: refreshed, error: refreshError } = await supabase
        .from('services').select('*').eq('id', service.id).single();
      saved = (refreshed ?? saved) as ServiceRequest;
      const inserted = saved;
      setServices((prev) => [...prev, inserted]);
      serviceRequest.current += 1;
      setServicesLoading(false);
      if (refreshError) return { success: true, error: `Service saved, but details could not be refreshed: ${refreshError.message}` };
      return { success: true };
    } catch (error) {
      if (saved) {
        const inserted = saved;
        setServices((prev) => [...prev, inserted]);
        serviceRequest.current += 1;
        setServicesLoading(false);
        return { success: true, error: 'Service saved, but details could not be refreshed. Reload the page.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save service' };
    }
  }
  async function updateService(service: ServiceRequest): Promise<{ success: boolean; error?: string }> {
    let saved: ServiceRequest | undefined;
    try {
      const query = supabase.from('services').update(toServicePayload(service)).eq('id', service.id);
      const { data, error } = await (service.updatedAt
        ? query.eq('updatedAt', service.updatedAt)
        : query.is('updatedAt', null)).select().maybeSingle();
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Service changed or is no longer accessible. Refresh and try again.' };
      saved = data as ServiceRequest;
      const { data: refreshed, error: refreshError } = await supabase
        .from('services').select('*').eq('id', service.id).single();
      saved = (refreshed ?? saved) as ServiceRequest;
      const updated = saved;
      setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
      serviceRequest.current += 1;
      setServicesLoading(false);
      if (refreshError) return { success: true, error: `Service updated, but details could not be refreshed: ${refreshError.message}` };
      return { success: true };
    } catch (error) {
      if (saved) {
        const updated = saved;
        setServices((prev) => prev.map((s) => (s.id === service.id ? updated : s)));
        serviceRequest.current += 1;
        setServicesLoading(false);
        return { success: true, error: 'Service updated, but details could not be refreshed. Reload the page.' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update service' };
    }
  }
  async function deleteService(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await deleteServiceRecord(supabase, id);
    if (result.success) {
      serviceRequest.current += 1;
      setServicesLoading(false);
      setServices((prev) => prev.filter((s) => s.id !== id));
    }
    return result;
  }

  return (
    <DataContext.Provider
      value={{
        employees, addEmployee, updateEmployee, deleteEmployee,
        stocks, addStock, updateStock, deleteStock, decrementStock,
        sales, addSale, updateSale, deleteSale,
        services, serviceTechnicians, servicesLoading, servicesError, refreshServices,
        addService, updateService, deleteService,
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
