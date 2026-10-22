import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { generateId, generateServiceNo, today } from '../../utils/helpers';
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
  const { employees, services, addService, updateService } = useData();
  const technicians = employees.filter((e) => e.role === 'technician' && e.status === 'active');

  const [form, setForm] = useState({
    serialNo: editService?.serialNo ?? '',
    serviceNo: editService?.serviceNo ?? generateServiceNo(services.length),
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
    technicianId: editService?.technicianId ?? '',
    status: (editService?.status ?? 'open') as ServiceStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.serialNo.trim()) e.serialNo = 'Serial number is required';
    if (!form.customerName.trim() || form.customerName.trim().length < 2)
      e.customerName = 'Name must be at least 2 characters';
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = 'Enter a valid 10-digit Indian mobile number';
    if (!form.area.trim()) e.area = 'Area is required';
    if (!form.townVillage.trim()) e.townVillage = 'Town/Village is required';
    if (!form.modelNumber.trim()) e.modelNumber = 'Model number is required';
    if (!form.complaintDate) e.complaintDate = 'Complaint date is required';
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const technician = employees.find((emp) => emp.id === form.technicianId);
    const service: ServiceRequest = {
      id: editService?.id ?? generateId(),
      ...form,
      technicianName: technician?.name ?? '',
    };
    if (editService) {
      updateService(service);
    } else {
      addService(service);
    }
    onClose();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="svc-serial">Serial No</label>
          <input className="form-input" id="svc-serial" type="text"
            placeholder="AC unit serial number" value={form.serialNo} onChange={set('serialNo')} />
          {errors.serialNo && <span className="form-error">{errors.serialNo}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-no">Service No</label>
          <input className="form-input form-input--readonly" id="svc-no" type="text"
            value={form.serviceNo} readOnly />
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
          <label className="form-label" htmlFor="svc-area">Area</label>
          <input className="form-input" id="svc-area" type="text"
            placeholder="e.g. Kukatpally" value={form.area} onChange={set('area')} />
          {errors.area && <span className="form-error">{errors.area}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-town">Town/Village</label>
          <input className="form-input" id="svc-town" type="text"
            placeholder="e.g. Hyderabad" value={form.townVillage} onChange={set('townVillage')} />
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
          <label className="form-label" htmlFor="svc-model">Model Number</label>
          <input className="form-input" id="svc-model" type="text"
            placeholder="e.g. FS518YATU" value={form.modelNumber} onChange={set('modelNumber')} />
          {errors.modelNumber && <span className="form-error">{errors.modelNumber}</span>}
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
          <label className="form-label" htmlFor="svc-technician">Technician</label>
          <select className="form-select" id="svc-technician" value={form.technicianId} onChange={set('technicianId')}>
            <option value="">— Select Technician —</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>{tech.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="svc-status">Status</label>
          <select className="form-select" id="svc-status" value={form.status} onChange={set('status')}>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary">
          {editService ? 'Update Service' : 'Add Service'}
        </button>
      </div>
    </form>
  );
}
