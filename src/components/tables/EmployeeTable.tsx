import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { formatRupees, formatDate } from '../../utils/helpers';
import { AddEmployeeForm } from '../forms/AddEmployeeForm';
import { IconEdit, IconTrash } from '../Icons';
import type { Employee, EmployeeRole, EmployeeStatus } from '../../types';

const ROLE_BADGE: Record<EmployeeRole, string> = {
  manager: 'badge--primary',
  sales: 'badge--success',
  technician: 'badge--warning',
  admin: 'badge--danger',
};

const ROLE_LABELS: Record<EmployeeRole, string> = {
  manager: 'Manager', sales: 'Sales', technician: 'Technician', admin: 'Admin',
};

export function EmployeeTable() {
  const { employees, deleteEmployee } = useData();
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<EmployeeStatus | 'all'>('all');

  const filtered = employees
    .filter((e) => filterStatus === 'all' || e.status === filterStatus)
    .filter((e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.empId.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase())
    );

  if (editEmp) {
    return (
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Edit Employee</h3>
        </div>
        <div className="card__body">
          <AddEmployeeForm editEmployee={editEmp} onClose={() => setEditEmp(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Employee Records</h3>
        <span className="badge badge--primary">{filtered.length} employees</span>
      </div>
      <div className="card__body">
        <div className="table-controls">
          <input
            className="form-input"
            type="search"
            placeholder="Search name, ID, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '260px' }}
          />
          <div className="filter-tabs">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                className={`filter-tab${filterStatus === f ? ' filter-tab--active' : ''}`}
                onClick={() => setFilterStatus(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Join Date</th>
                <th>Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No employees found
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td><span className="emp-id-pill">{emp.empId}</span></td>
                    <td><strong>{emp.name}</strong></td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[emp.role]}`}>{ROLE_LABELS[emp.role]}</span>
                    </td>
                    <td>{emp.phone}</td>
                    <td>{emp.email}</td>
                    <td>{formatDate(emp.joinDate)}</td>
                    <td>{formatRupees(emp.salary)}</td>
                    <td>
                      <span className={`badge ${emp.status === 'active' ? 'badge--success' : 'badge--danger'}`}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--secondary btn--sm" onClick={() => setEditEmp(emp)}><IconEdit /></button>
                        <button className="btn btn--danger btn--sm" onClick={() => {
                          if (confirm(`Delete ${emp.name}?`)) deleteEmployee(emp.id);
                        }}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
