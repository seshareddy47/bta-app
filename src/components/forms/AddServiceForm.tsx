import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { generateId, today } from '../../utils/helpers';
import { technicianName, technicianOptions } from '../../utils/serviceOperations';
import type { ServiceRequest, ComplaintType, ServiceStatus } from '../../types';

interface Props {
  onClose: () => void;
  editService?: ServiceRequest;
}

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

export function AddServiceForm({ onClose, editService }: Props) {
  const { serviceTechnicians, addService, updateService } = useData();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    // Service No is optional/manual, left blank by default (no auto-generation).
    serviceNo: editService?.serviceNo ?? '',
    complaintDate: editService?.complaintDate ?? today(),
    customerName: editService?.customerName ?? '',
    mobile: editService?.mobile ?? '',
    area: editService?.area ?? '',
    townVillage: editService?.townVillage ?? '',
    invoiceNumber: editService?.invoiceNumber ?? '',
    invoiceDate: editService?.invoiceDate ?? '',
    modelNumber: editService?.modelNumber ?? '',
    complaintType: (editService?.complaintType ?? 'repair') as ComplaintType,
    attendedDate: editService?.attendedDate ?? '',
    technicianId1: editService?.technicianId1 ?? '',
    technicianId2: editService?.technicianId2 ?? '',
    status: (editService?.status ?? 'open') as ServiceStatus,
    notes: editService?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [clearUnlinkedTechnician2, setClearUnlinkedTechnician2] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.customerName.trim() || form.customerName.trim().length < 2)
      e.customerName = 'Name must be at least 2 characters';
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit Indian mobile number';
    if (!form.townVillage.trim()) e.townVillage = 'Town/Village is required';
    if (!form.complaintDate) e.complaintDate = 'Complaint date is required';
    if (form.technicianId1 && form.technicianId1 === form.technicianId2)
      e.technicianId2 = 'Select different technicians';
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const service: ServiceRequest = {
      ...editService,
      id: editService?.id ?? generateId(),
      // DB-generated and immutable — keep the existing value on edit, blank (filled in once
      // the insert returns) for a new record.
      serialNo: editService?.serialNo ?? '',
      ...form,
      technicianName1: technicianName(form.technicianId1, editService?.technicianId1, editService?.technicianName1, serviceTechnicians),
      technicianName2: clearUnlinkedTechnician2 && !form.technicianId2 ? ''
        : technicianName(form.technicianId2, editService?.technicianId2, editService?.technicianName2, serviceTechnicians),
    };
    if (editService) {
      setSubmitting(true);
      const result = await updateService(service);
      setSubmitting(false);
      if (result.success) {
        showToast(result.error ?? 'Service updated successfully', result.error ? 'error' : 'success');
        onClose();
      } else {
        showToast(result.error ?? 'Failed to update service', 'error');
      }
    } else {
      setSubmitting(true);
      const result = await addService(service);
      setSubmitting(false);
      if (result.success) {
        if (result.error) showToast(result.error, 'error');
        onClose();
      } else {
        showToast(result.error ?? 'Failed to add service', 'error');
      }
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-serial">Serial No</label>
          <input className="form-input form-input--readonly" id="svc-serial" type="text"
            value={editService ? editService.serialNo : 'Auto-generated on save'} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-no">Service No (optional)</label>
          <input className="form-input" id="svc-no" type="text"
            placeholder="e.g. SRV0001" value={form.serviceNo} onChange={set('serviceNo')} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-customer">Customer Name</label>
          <input className="form-input" id="svc-customer" type="text"
            placeholder="Customer's full name" value={form.customerName} onChange={set('customerName')} />
          {errors.customerName && <span className="form-error">{errors.customerName}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-mobile">Mobile</label>
          <input className="form-input" id="svc-mobile" type="tel"
            placeholder="10-digit mobile" value={form.mobile} onChange={set('mobile')} />
          {errors.mobile && <span className="form-error">{errors.mobile}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-area">Area (optional)</label>
          <input className="form-input" id="svc-area" type="text"
            placeholder="e.g. Surya Rao Peta" value={form.area} onChange={set('area')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-town">Town/Village</label>
          <input className="form-input" id="svc-town" type="text"
            placeholder="e.g. Kakinada" value={form.townVillage} onChange={set('townVillage')} />
          {errors.townVillage && <span className="form-error">{errors.townVillage}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-invoice-no">Invoice Number</label>
          <input className="form-input" id="svc-invoice-no" type="text"
            placeholder="e.g. INV-20250105100001" value={form.invoiceNumber} onChange={set('invoiceNumber')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-invoice-date">Invoice Date</label>
          <input className="form-input" id="svc-invoice-date" type="date"
            value={form.invoiceDate} onChange={set('invoiceDate')} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-model">Model Number (optional)</label>
          <input className="form-input" id="svc-model" type="text"
            placeholder="e.g. FS518YATU" value={form.modelNumber} onChange={set('modelNumber')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-type">Type of Complaint</label>
          <select className="form-select" id="svc-type" value={form.complaintType} onChange={set('complaintType')}>
            {(Object.keys(COMPLAINT_TYPE_LABELS) as ComplaintType[]).map((type) => (
              <option key={type} value={type}>{COMPLAINT_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-complaint-date">Complaint Date</label>
          <input className="form-input" id="svc-complaint-date" type="date"
            value={form.complaintDate} onChange={set('complaintDate')} />
          {errors.complaintDate && <span className="form-error">{errors.complaintDate}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-attended-date">Attended Date</label>
          <input className="form-input" id="svc-attended-date" type="date"
            value={form.attendedDate} onChange={set('attendedDate')} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-technician1">Technician 1</label>
          <select className="form-select" id="svc-technician1" value={form.technicianId1} onChange={set('technicianId1')}>
            <option value="">— Select Technician —</option>
            {technicianOptions(serviceTechnicians, editService?.technicianId1, editService?.technicianName1, form.technicianId2).map((tech) => (
              <option key={tech.id} value={tech.id}>{tech.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-technician2">Technician 2 (optional)</label>
          <select className="form-select" id="svc-technician2" value={form.technicianId2} onChange={set('technicianId2')}>
            <option value="">— None —</option>
            {technicianOptions(serviceTechnicians, editService?.technicianId2, editService?.technicianName2, form.technicianId1).map((tech) => (
              <option key={tech.id} value={tech.id}>{tech.label}</option>
            ))}
          </select>
          {errors.technicianId2 && <span className="form-error">{errors.technicianId2}</span>}
          {editService?.technicianName2 && !editService.technicianId2 && !form.technicianId2 && !clearUnlinkedTechnician2 && (
            <span className="form-hint">
              Current: {editService.technicianName2} (unlinked){' '}
              <button type="button" className="btn btn--secondary btn--sm"
                onClick={() => setClearUnlinkedTechnician2(true)}>Clear</button>
            </span>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-status">Status</label>
          <select className="form-select" id="svc-status" value={form.status} onChange={set('status')}>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-notes">Notes (optional)</label>
          <textarea className="form-input" id="svc-notes" rows={4}
            placeholder="Optional notes about this service" value={form.notes} onChange={set('notes')} />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : editService ? 'Update Service' : 'Add Service'}
        </button>
      </div>
    </form>
  );
}
