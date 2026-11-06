import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/helpers';
import { AddServiceForm } from '../forms/AddServiceForm';
import { ServiceFormHeader } from '../ServiceFormHeader';
import { Modal } from '../Modal';
import { IconEdit, IconTrash, IconNote } from '../Icons';
import type { ServiceRequest, ServiceStatus, ComplaintType } from '../../types';

const STATUS_BADGE: Record<ServiceStatus, string> = {
  open: 'badge--danger',
  'in-progress': 'badge--warning',
  completed: 'badge--success',
  cancelled: 'badge--danger',
  urgent: 'badge--danger',
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  open: 'Open', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled', urgent: 'Urgent',
};

const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  installation: 'Installation',
  'gas-refill': 'Gas Refill',
  repair: 'Repair',
  maintenance: 'Maintenance',
  'noise-issue': 'Noise Issue',
  'water-leakage': 'Water Leakage',
  'remote-issue': 'Remote Issue',
  other: 'Other',
};

export function ServiceTable() {
  const { services, servicesLoading, servicesError, deleteService } = useData();
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSvc, setDeleteSvc] = useState<ServiceRequest | null>(null);
  const [editSvc, setEditSvc] = useState<ServiceRequest | null>(null);
  const [notesSvc, setNotesSvc] = useState<ServiceRequest | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ServiceStatus | 'all'>('all');

  async function handleDelete(service: ServiceRequest) {
    setDeletingId(service.id);
    const result = await deleteService(service.id);
    setDeletingId(null);
    if (result.success) setDeleteSvc(null);
    showToast(result.success ? 'Service deleted successfully' : result.error ?? 'Failed to delete service',
      result.success ? 'success' : 'error');
  }

  const filtered = services
    .filter((s) => filterStatus === 'all' || s.status === filterStatus)
    .filter((s) =>
      !search ||
      s.customerName.toLowerCase().includes(search.toLowerCase()) ||
      (s.serviceNo ?? '').toLowerCase().includes(search.toLowerCase()) ||
      s.serialNo.toLowerCase().includes(search.toLowerCase()) ||
      s.mobile.includes(search) ||
      (s.area ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : NaN;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : NaN;
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
      if (!Number.isFinite(bTime)) return -1;
      return bTime - aTime;
    });

  if (editSvc) {
    return (
      <div className="card">
        <ServiceFormHeader service={editSvc} />
        <div className="card__body">
          <AddServiceForm editService={editSvc} onClose={() => setEditSvc(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Service Records</h3>
        <span className="badge badge--primary">{filtered.length} services</span>
      </div>
      <div className="card__body">
        <div className="table-controls">
          <input
            className="form-input"
            type="search"
            placeholder="Search customer, service no, serial no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '260px' }}
          />
          <div className="filter-tabs">
            {(['all', 'open', 'in-progress', 'completed', 'cancelled', 'urgent'] as const).map((f) => (
              <button
                key={f}
                className={`filter-tab${filterStatus === f ? ' filter-tab--active' : ''}`}
                onClick={() => setFilterStatus(f)}
              >
                {f === 'all' ? 'All' : STATUS_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial No</th>
                <th>Service No</th>
                <th>Complaint Date</th>
                <th>Customer Name</th>
                <th>Mobile</th>
                <th>Area</th>
                <th>Town/Village</th>
                <th>Invoice Number</th>
                <th>Invoice Date</th>
                <th>Model Number</th>
                <th>Type of Complaint</th>
                <th>Attended Date</th>
                <th>Technician 1</th>
                <th>Technician 2</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    {servicesLoading ? 'Loading service records…' : servicesError ? 'Service data unavailable' : 'No service records found'}
                  </td>
                </tr>
              ) : (
                filtered.map((svc) => (
                  <tr key={svc.id}>
                    <td>{svc.serialNo}</td>
                    <td><span className="emp-id-pill">{svc.serviceNo || '—'}</span></td>
                    <td>{formatDate(svc.complaintDate)}</td>
                    <td><strong>{svc.customerName}</strong></td>
                    <td>{svc.mobile}</td>
                    <td>{svc.area || '—'}</td>
                    <td>{svc.townVillage}</td>
                    <td>{svc.invoiceNumber || '—'}</td>
                    <td>{svc.invoiceDate ? formatDate(svc.invoiceDate) : '—'}</td>
                    <td>{svc.modelNumber || '—'}</td>
                    <td>{COMPLAINT_TYPE_LABELS[svc.complaintType]}</td>
                    <td>{svc.attendedDate ? formatDate(svc.attendedDate) : '—'}</td>
                    <td>{svc.technicianName1 || '—'}</td>
                    <td>{svc.technicianName2 || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[svc.status]}`}>{STATUS_LABELS[svc.status]}</span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--secondary btn--sm" onClick={() => setEditSvc(svc)} title="Edit" aria-label="Edit service"><IconEdit /></button>
                        <button
                          className={`btn btn--secondary btn--sm ${svc.notes ? 'icon-btn--active' : 'icon-btn--muted'}`}
                          onClick={() => setNotesSvc(svc)}
                          title="Notes"
                          aria-label="View service notes"
                        ><IconNote /></button>
                        <button className="btn btn--danger btn--sm" disabled={deletingId !== null}
                          onClick={() => setDeleteSvc(svc)} title="Delete" aria-label="Delete service"><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {notesSvc && (
        <Modal title="Service Notes" onClose={() => setNotesSvc(null)}>
          <p>{notesSvc.notes || 'No notes available'}</p>
          <div className="modal__footer">
            <button className="btn btn--secondary" onClick={() => setNotesSvc(null)}>Close</button>
          </div>
        </Modal>
      )}
      {deleteSvc && (
        <Modal title="Delete Service" onClose={() => {
          if (!deletingId) setDeleteSvc(null);
        }}>
          <p>Are you sure you want to delete service {deleteSvc.serviceNo || deleteSvc.serialNo}?</p>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" disabled={deletingId !== null}
              onClick={() => setDeleteSvc(null)}>Cancel</button>
            <button type="button" className="btn btn--danger" disabled={deletingId !== null}
              onClick={() => void handleDelete(deleteSvc)}>
              {deletingId ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
