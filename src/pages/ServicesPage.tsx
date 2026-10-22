import { useState } from 'react';
import { useData } from '../context/DataContext';
import { ServiceTable } from '../components/tables/ServiceTable';
import { AddServiceForm } from '../components/forms/AddServiceForm';
import { IconService, IconClock, IconCheckCircle } from '../components/Icons';

type Tab = 'table' | 'add';

const SYNC_BADGE: Record<string, string> = {
  idle: 'badge--primary',
  syncing: 'badge--warning',
  synced: 'badge--success',
  error: 'badge--danger',
};

const SYNC_LABEL: Record<string, string> = {
  idle: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
};

export function ServicesPage() {
  const [tab, setTab] = useState<Tab>('table');
  const {
    services,
    servicesSyncEnabled,
    servicesSyncStatus,
    servicesSyncError,
    servicesLastSyncedAt,
    syncServicesFromSheet,
  } = useData();

  const open = services.filter((s) => s.status === 'open').length;
  const inProgress = services.filter((s) => s.status === 'in-progress').length;
  const completed = services.filter((s) => s.status === 'completed').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Service</h1>
          <p className="page-subtitle">Track customer complaints and service visits</p>
        </div>
        <div className="page-header-actions">
          {servicesSyncEnabled && (
            <>
              <span
                className={`badge ${SYNC_BADGE[servicesSyncStatus]}`}
                title={servicesSyncError ?? (servicesLastSyncedAt ? `Last synced ${new Date(servicesLastSyncedAt).toLocaleString('en-IN')}` : undefined)}
              >
                {SYNC_LABEL[servicesSyncStatus]}
              </span>
              <button
                className="btn btn--secondary"
                onClick={() => syncServicesFromSheet()}
                disabled={servicesSyncStatus === 'syncing'}
              >
                ⟳ Sync with Sheet
              </button>
            </>
          )}
          <button
            className={`btn ${tab === 'add' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab((t) => (t === 'add' ? 'table' : 'add'))}
          >
            {tab === 'add' ? '← Back to Table' : '+ Add Service'}
          </button>
        </div>
      </div>

      {tab === 'table' && (
        <div className="stats-grid stats-grid--sm">
          <div className="stat-card stat-card--primary">
            <span className="stat-card__icon"><IconService /></span>
            <div>
              <p className="stat-card__label">Total Requests</p>
              <p className="stat-card__value">{services.length}</p>
            </div>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__icon"><IconClock /></span>
            <div>
              <p className="stat-card__label">Open</p>
              <p className="stat-card__value">{open}</p>
            </div>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__icon"><IconClock /></span>
            <div>
              <p className="stat-card__label">In Progress</p>
              <p className="stat-card__value">{inProgress}</p>
            </div>
          </div>
          <div className="stat-card stat-card--success">
            <span className="stat-card__icon"><IconCheckCircle /></span>
            <div>
              <p className="stat-card__label">Completed</p>
              <p className="stat-card__value">{completed}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'add' ? (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Add Service</h3>
          </div>
          <div className="card__body">
            <AddServiceForm onClose={() => setTab('table')} />
          </div>
        </div>
      ) : (
        <ServiceTable />
      )}
    </div>
  );
}
