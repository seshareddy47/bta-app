import { useState } from 'react';
import { useData } from '../context/DataContext';
import { SalesTable } from '../components/tables/SalesTable';
import { AddSaleForm } from '../components/forms/AddSaleForm';
import { formatRupees } from '../utils/helpers';
import { IconSales, IconCheckCircle, IconClock } from '../components/Icons';

type Tab = 'table' | 'add';

export function SalesPage() {
  const [tab, setTab] = useState<Tab>('table');
  const { sales } = useData();

  const completed = sales.filter((s) => s.status === 'completed');
  const totalRevenue = completed.reduce((sum, s) => sum + s.totalAmount, 0);
  const pending = sales.filter((s) => s.status === 'pending').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">Manage all AC sales transactions</p>
        </div>
        <div className="page-header-actions">
          <button
            className={`btn ${tab === 'add' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab((t) => (t === 'add' ? 'table' : 'add'))}
          >
            {tab === 'add' ? '← Back to Table' : '+ Add Sale'}
          </button>
        </div>
      </div>

      {tab === 'table' && (
        <div className="stats-grid stats-grid--sm">
          <div className="stat-card stat-card--primary">
            <span className="stat-card__icon"><IconSales /></span>
            <div>
              <p className="stat-card__label">Total Revenue</p>
              <p className="stat-card__value">{formatRupees(totalRevenue)}</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <span className="stat-card__icon"><IconCheckCircle /></span>
            <div>
              <p className="stat-card__label">Completed</p>
              <p className="stat-card__value">{completed.length}</p>
            </div>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__icon"><IconClock /></span>
            <div>
              <p className="stat-card__label">Pending</p>
              <p className="stat-card__value">{pending}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'add' ? (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">New Sale</h3>
          </div>
          <div className="card__body">
            <AddSaleForm onClose={() => setTab('table')} />
          </div>
        </div>
      ) : (
        <SalesTable />
      )}
    </div>
  );
}
