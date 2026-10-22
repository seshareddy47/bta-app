---
name: sales-management
description: "Use when: adding, editing, viewing, or reporting on sales in the Blue Star AC Shop. Covers the Sale TypeScript model, AddSaleForm field rules, SalesTable columns, and Recharts bar/line chart patterns for monthly revenue. Load when implementing any sales-related feature."
---

# Sales Management

## When to Use
- Implementing the Add Sale form
- Building or modifying the sales data table
- Creating revenue/sales charts in the Reports page
- Extending the Sale data model

## TypeScript Model

```typescript
// src/types/index.ts
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'emi';
export type SaleStatus = 'completed' | 'pending' | 'cancelled';

export interface Sale {
  id: string;                  // UUID — generated at creation
  date: string;                // ISO date string: YYYY-MM-DD
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;         // e.g. "Blue Star 1.5T 5★ Split AC"
  quantity: number;
  unitPrice: number;           // in rupees
  totalAmount: number;         // quantity * unitPrice
  employeeId: string;
  employeeName: string;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  notes?: string;
}
```

## AddSaleForm Fields & Validation

| Field | Input Type | Validation |
|-------|-----------|-----------|
| Customer Name | text | Required, min 2 chars |
| Customer Phone | tel | Required, 10-digit Indian mobile |
| Product | select (from stock) | Required |
| Quantity | number | Required, min 1, ≤ available stock |
| Unit Price | number (auto-filled from stock, editable) | Required, > 0 |
| Employee | select (from employees) | Required |
| Payment Method | select (cash/card/upi/emi) | Required |
| Sale Date | date | Required, defaults to today |
| Status | select (completed/pending/cancelled) | Required |
| Notes | textarea | Optional |

### Form JSX pattern
```tsx
import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { generateId } from '../../utils/helpers';
import type { Sale } from '../../types';

export function AddSaleForm({ onClose }: { onClose: () => void }) {
  const { stocks, employees, addSale } = useData();
  const [form, setForm] = useState({ customerName: '', customerPhone: '',
    productId: '', quantity: 1, unitPrice: 0, employeeId: '',
    paymentMethod: 'cash' as const, date: new Date().toISOString().slice(0, 10),
    status: 'completed' as const, notes: '' });

  const selectedStock = stocks.find(s => s.id === form.productId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sale: Sale = {
      id: generateId(),
      ...form,
      productName: selectedStock?.productName ?? '',
      employeeName: employees.find(emp => emp.id === form.employeeId)?.name ?? '',
      totalAmount: form.quantity * form.unitPrice,
    };
    addSale(sale);
    onClose();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {/* fields using .form-group / .form-label / .form-input patterns */}
    </form>
  );
}
```

## SalesTable Columns

| Column | Key | Sortable | Format |
|--------|-----|---------|--------|
| # | index | - | row number |
| Date | date | ✓ | DD/MM/YYYY |
| Customer | customerName | ✓ | plain text |
| Product | productName | - | plain text |
| Qty | quantity | - | number |
| Amount | totalAmount | ✓ | ₹ formatted |
| Employee | employeeName | - | plain text |
| Payment | paymentMethod | - | Badge uppercase |
| Status | status | - | Badge colored |
| Actions | - | - | Edit / Delete icon buttons |

### Status badge mapping
```tsx
const STATUS_BADGE: Record<SaleStatus, string> = {
  completed: 'badge--success',
  pending: 'badge--warning',
  cancelled: 'badge--danger',
};
```

## Recharts Patterns

### Monthly Revenue Bar Chart
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Aggregate sales by month
const monthlyData = aggregateSalesByMonth(sales); // returns [{month:'Jan', revenue:250000}, ...]

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={monthlyData}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
           tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
    <Bar dataKey="revenue" fill="var(--primary)" radius={[4,4,0,0]} />
  </BarChart>
</ResponsiveContainer>
```

### Unit Sales Line Chart
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={260}>
  <LineChart data={monthlySalesCount}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="units" stroke="var(--primary)" strokeWidth={2} dot={{ fill: 'var(--primary)' }} />
  </LineChart>
</ResponsiveContainer>
```

### Aggregation helper
```typescript
// src/utils/helpers.ts
export function aggregateSalesByMonth(sales: Sale[]) {
  const map: Record<string, { month: string; revenue: number; units: number }> = {};
  sales.forEach(s => {
    const key = s.date.slice(0, 7); // YYYY-MM
    const label = new Date(s.date).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    if (!map[key]) map[key] = { month: label, revenue: 0, units: 0 };
    if (s.status === 'completed') {
      map[key].revenue += s.totalAmount;
      map[key].units += s.quantity;
    }
  });
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}
```

## Rupee Formatting Convention
Always use Indian locale formatting:
```typescript
export const formatRupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
```

## Procedure: Add the Sales Page
1. Ensure `Sale` interface exists in `src/types/index.ts`
2. Add `sales` array + `addSale` / `updateSale` / `deleteSale` to `DataContext`
3. Create `src/pages/SalesPage.tsx` with tab state: `'table' | 'add'`
4. In table tab: render `<SalesTable sales={sales} />`
5. In add tab (or modal): render `<AddSaleForm onClose={() => setTab('table')} />`
6. Register route in `App.tsx`: `<Route path="/sales" element={<SalesPage />} />`
7. Add nav item "Sales" with icon to `Sidebar.tsx`
