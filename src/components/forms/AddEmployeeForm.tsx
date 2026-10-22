import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { generateId, generateEmpId, today } from '../../utils/helpers';
import type { Employee, EmployeeRole, EmployeeStatus } from '../../types';

interface Props {
  onClose: () => void;
  editEmployee?: Employee;
}

export function AddEmployeeForm({ onClose, editEmployee }: Props) {
  const { employees, addEmployee, updateEmployee } = useData();

  const [form, setForm] = useState({
    name: editEmployee?.name ?? '',
    empId: editEmployee?.empId ?? generateEmpId(employees.length),
    role: (editEmployee?.role ?? 'sales') as EmployeeRole,
    phone: editEmployee?.phone ?? '',
    email: editEmployee?.email ?? '',
    joinDate: editEmployee?.joinDate ?? today(),
    salary: editEmployee?.salary ?? 0,
    status: (editEmployee?.status ?? 'active') as EmployeeStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.empId.trim()) e.empId = 'Employee ID is required';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.joinDate) e.joinDate = 'Join date is required';
    if (form.salary <= 0) e.salary = 'Salary must be greater than 0';
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const emp: Employee = { id: editEmployee?.id ?? generateId(), ...form };
    if (editEmployee) {
      updateEmployee(emp);
    } else {
      addEmployee(emp);
    }
    onClose();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="emp-name">Full Name</label>
          <input className="form-input" id="emp-name" type="text"
            placeholder="Employee's full name" value={form.name} onChange={set('name')} />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="emp-id">Employee ID</label>
          <input className="form-input" id="emp-id" type="text"
            placeholder="e.g. EMP005" value={form.empId} onChange={set('empId')} />
          {errors.empId && <span className="form-error">{errors.empId}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="emp-role">Role</label>
          <select className="form-select" id="emp-role" value={form.role} onChange={set('role')}>
            <option value="sales">Sales</option>
            <option value="manager">Manager</option>
            <option value="technician">Technician</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="emp-status">Status</label>
          <select className="form-select" id="emp-status" value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="emp-phone">Phone</label>
          <input className="form-input" id="emp-phone" type="tel"
            placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} />
          {errors.phone && <span className="form-error">{errors.phone}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="emp-email">Email</label>
          <input className="form-input" id="emp-email" type="email"
            placeholder="employee@bluestar.com" value={form.email} onChange={set('email')} />
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="emp-join">Join Date</label>
          <input className="form-input" id="emp-join" type="date"
            value={form.joinDate} onChange={set('joinDate')} />
          {errors.joinDate && <span className="form-error">{errors.joinDate}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="emp-salary">Monthly Salary (₹)</label>
          <input className="form-input" id="emp-salary" type="number"
            min={1} placeholder="e.g. 35000" value={form.salary} onChange={set('salary')} />
          {errors.salary && <span className="form-error">{errors.salary}</span>}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary">
          {editEmployee ? 'Update Employee' : 'Add Employee'}
        </button>
      </div>
    </form>
  );
}
