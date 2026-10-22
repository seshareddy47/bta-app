---
name: employee-management
description: "Use when: adding, viewing, editing, or managing employees in the Blue Star AC Shop system. Covers the Employee TypeScript model, AddEmployeeForm field rules, EmployeeTable columns with role badges. Load when implementing any employee-related feature."
---

# Employee Management

## When to Use
- Implementing the Add Employee form
- Building or modifying the employees data table
- Displaying employee role badges
- Extending the Employee data model

## TypeScript Model

```typescript
// src/types/index.ts
export type EmployeeRole = 'manager' | 'sales' | 'technician' | 'admin';
export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  id: string;            // UUID
  empId: string;         // Human-readable: e.g. "EMP001"
  name: string;
  role: EmployeeRole;
  phone: string;         // 10-digit mobile
  email: string;
  joinDate: string;      // YYYY-MM-DD
  salary: number;        // monthly in rupees
  status: EmployeeStatus;
}
```

## AddEmployeeForm Fields & Validation

| Field | Input Type | Validation |
|-------|-----------|-----------|
| Full Name | text | Required, min 2 chars |
| Employee ID | text | Required, auto-generated (EMP + 3 digits), editable |
| Role | select | Required: manager/sales/technician/admin |
| Phone | tel | Required, 10-digit Indian mobile |
| Email | email | Required, valid email format |
| Join Date | date | Required, defaults to today |
| Monthly Salary (₹) | number | Required, > 0 |
| Status | select | Required: active/inactive |

### Phone validation regex
```typescript
const PHONE_REGEX = /^[6-9]\d{9}$/; // Indian mobile numbers start with 6-9
```

### Form JSX pattern
```tsx
import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { generateId, generateEmpId } from '../../utils/helpers';
import type { Employee } from '../../types';

export function AddEmployeeForm({ onClose }: { onClose: () => void }) {
  const { employees, addEmployee } = useData();
  const [form, setForm] = useState({
    name: '', role: 'sales' as EmployeeRole, phone: '', email: '',
    joinDate: new Date().toISOString().slice(0, 10), salary: 0,
    status: 'active' as EmployeeStatus,
    empId: generateEmpId(employees.length),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addEmployee({ id: generateId(), ...form });
    onClose();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      {/* use .form-group / .form-label / .form-input from design system */}
    </form>
  );
}
```

## EmployeeTable Columns

| Column | Key | Sortable | Format |
|--------|-----|---------|--------|
| Emp ID | empId | - | monospace pill |
| Name | name | ✓ | plain text |
| Role | role | - | Badge (colored by role) |
| Phone | phone | - | formatted |
| Email | email | - | plain text |
| Join Date | joinDate | ✓ | DD/MM/YYYY |
| Salary | salary | ✓ | ₹ formatted |
| Status | status | - | Badge |
| Actions | - | - | Edit / Deactivate icon buttons |

### Role badge color mapping
```tsx
const ROLE_BADGE: Record<EmployeeRole, string> = {
  manager:    'badge--primary',   // indigo
  sales:      'badge--success',   // green
  technician: 'badge--warning',   // amber
  admin:      'badge--danger',    // red (for visibility)
};
```

### Status badge mapping
```tsx
const STATUS_BADGE: Record<EmployeeStatus, string> = {
  active:   'badge--success',
  inactive: 'badge--danger',
};
```

## EmpId Generator Helper
```typescript
// src/utils/helpers.ts
export function generateEmpId(currentCount: number): string {
  return `EMP${String(currentCount + 1).padStart(3, '0')}`;
}
```

## Procedure: Add the Employees Page
1. Ensure `Employee` interface exists in `src/types/index.ts`
2. Add `employees` array + `addEmployee` / `updateEmployee` / `deactivateEmployee` to `DataContext`
3. Seed initial employees in localStorage if empty (at least 2-3 sample records)
4. Create `src/pages/EmployeesPage.tsx` with view state: `'table' | 'add'`
5. In table view: render `<EmployeeTable employees={employees} />`
6. In add view: render `<AddEmployeeForm onClose={() => setView('table')} />`
7. Register route in `App.tsx`: `<Route path="/employees" element={<EmployeesPage />} />`
8. Add nav item "Employees" with icon to `Sidebar.tsx`

## Sample Seed Data
```typescript
export const SEED_EMPLOYEES: Employee[] = [
  { id: 'emp-1', empId: 'EMP001', name: 'Ravi Kumar', role: 'manager',
    phone: '9876543210', email: 'ravi@bluestar.com', joinDate: '2022-01-15',
    salary: 55000, status: 'active' },
  { id: 'emp-2', empId: 'EMP002', name: 'Priya Sharma', role: 'sales',
    phone: '9123456789', email: 'priya@bluestar.com', joinDate: '2023-06-01',
    salary: 32000, status: 'active' },
  { id: 'emp-3', empId: 'EMP003', name: 'Arun Reddy', role: 'technician',
    phone: '8456781234', email: 'arun@bluestar.com', joinDate: '2023-03-10',
    salary: 28000, status: 'active' },
];
```
