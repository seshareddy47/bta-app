import { useState } from 'react';
import { useData } from '../context/DataContext';
import { EmployeeTable } from '../components/tables/EmployeeTable';
import { AddEmployeeForm } from '../components/forms/AddEmployeeForm';
import { IconEmployees, IconCheckCircle, IconBan } from '../components/Icons';

type Tab = 'table' | 'add';

export function EmployeesPage() {
  const [tab, setTab] = useState<Tab>('table');
  const { employees } = useData();

  const active = employees.filter((e) => e.status === 'active').length;
  const inactive = employees.filter((e) => e.status === 'inactive').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Manage shop staff and their details</p>
        </div>
        <div className="page-header-actions">
          <button
            className={`btn ${tab === 'add' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab((t) => (t === 'add' ? 'table' : 'add'))}
          >
            {tab === 'add' ? '← Back to Table' : '+ Add Employee'}
          </button>
        </div>
      </div>

      {tab === 'table' && (
        <div className="stats-grid stats-grid--sm">
          <div className="stat-card stat-card--primary">
            <span className="stat-card__icon"><IconEmployees /></span>
            <div>
              <p className="stat-card__label">Total Staff</p>
              <p className="stat-card__value">{employees.length}</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <span className="stat-card__icon"><IconCheckCircle /></span>
            <div>
              <p className="stat-card__label">Active</p>
              <p className="stat-card__value">{active}</p>
            </div>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__icon"><IconBan /></span>
            <div>
              <p className="stat-card__label">Inactive</p>
              <p className="stat-card__value">{inactive}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'add' ? (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Add Employee</h3>
          </div>
          <div className="card__body">
            <AddEmployeeForm onClose={() => setTab('table')} />
          </div>
        </div>
      ) : (
        <EmployeeTable />
      )}
    </div>
  );
}
