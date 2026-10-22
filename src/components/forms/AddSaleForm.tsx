import { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { generateId, today, generateInvoiceNumber, addDays, detectSeason } from '../../utils/helpers';
import type {
  Sale, SaleItem, PaymentMethod, SaleStatus,
  CustomerType, LeadSource, InstallationStatus, SaleTargetCategory, CustomerSegment,
} from '../../types';

interface Props {
  onClose: () => void;
  editSale?: Sale;
}

function emptyItem(): SaleItem {
  return {
    id: generateId(),
    productName: '',
    modelNumber: '',
    sku: '',
    serialNumber: '',
    tonnage: '1.5T',
    acType: 'split',
    energyRating: '5 Star',
    quantity: 1,
    mrp: 0,
    sellingPrice: 0,
    discount: 0,
    gstPercent: 18,
    itemCost: 0,
  };
}

function detectSegment(total: number): CustomerSegment {
  if (total < 30000) return 'budget';
  if (total < 70000) return 'mid-range';
  return 'premium';
}

interface FormState {
  invoiceNumber: string;
  date: string;
  time: string;
  paymentMethod: PaymentMethod;
  employeeId: string;
  storeLocation: string;
  gstApplicable: boolean;
  status: SaleStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerType: CustomerType;
  billingAddress: string;
  shippingAddress: string;
  sameAsBilling: boolean;
  gstin: string;
  leadSource: LeadSource;
  pan: string;
  installationCharges: number;
  deliveryCharges: number;
  otherCharges: number;
  amountPaid: number;
  dueDate: string;
  installationRequired: boolean;
  installationDate: string;
  assignedTechnicianId: string;
  installationStatus: InstallationStatus;
  extraMaterialCharges: number;
  amcSold: boolean;
  extendedWarrantySold: boolean;
  salesCampaignId: string;
  targetCategory: SaleTargetCategory;
  notes: string;
}

export function AddSaleForm({ onClose, editSale }: Props) {
  const { employees, addSale, updateSale } = useData();

  const [form, setForm] = useState<FormState>({
    invoiceNumber: editSale?.invoiceNumber ?? generateInvoiceNumber(),
    date: editSale?.date ?? today(),
    time: editSale?.time ?? new Date().toTimeString().slice(0, 5),
    paymentMethod: editSale?.paymentMethod ?? 'cash',
    employeeId: editSale?.employeeId ?? '',
    storeLocation: editSale?.storeLocation ?? 'Bala Tripura Arcade',
    gstApplicable: editSale?.gstApplicable ?? true,
    status: editSale?.status ?? 'completed',
    customerName: editSale?.customerName ?? '',
    customerPhone: editSale?.customerPhone ?? '',
    customerEmail: editSale?.customerEmail ?? '',
    customerType: editSale?.customerType ?? 'individual',
    billingAddress: editSale?.billingAddress ?? '',
    shippingAddress: editSale?.shippingAddress ?? '',
    sameAsBilling: false,
    gstin: editSale?.gstin ?? '',
    leadSource: editSale?.leadSource ?? 'walk-in',
    pan: editSale?.pan ?? '',
    installationCharges: editSale?.installationCharges ?? 500,
    deliveryCharges: editSale?.deliveryCharges ?? 0,
    otherCharges: editSale?.otherCharges ?? 0,
    amountPaid: editSale?.amountPaid ?? 0,
    dueDate: editSale?.dueDate ?? '',
    installationRequired: editSale?.installationRequired ?? true,
    installationDate: editSale?.installationDate ?? '',
    assignedTechnicianId: editSale?.assignedTechnicianId ?? '',
    installationStatus: editSale?.installationStatus ?? 'pending',
    extraMaterialCharges: editSale?.extraMaterialCharges ?? 0,
    amcSold: editSale?.amcSold ?? false,
    extendedWarrantySold: editSale?.extendedWarrantySold ?? false,
    salesCampaignId: editSale?.salesCampaignId ?? '',
    targetCategory: editSale?.targetCategory ?? 'retail',
    notes: editSale?.notes ?? '',
  });

  const [items, setItems] = useState<SaleItem[]>(
    editSale?.items?.length ? editSale.items : [emptyItem()]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const activeEmployees = employees.filter((e) => e.status === 'active');
  const salesEmployees = activeEmployees.filter((e) =>
    ['sales', 'manager', 'admin'].includes(e.role)
  );
  const technicians = activeEmployees.filter((e) => e.role === 'technician');

  // ── Computed financials ────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.quantity * it.sellingPrice, 0),
    [items]
  );
  const totalDiscount = useMemo(
    () => items.reduce((s, it) => s + it.discount * it.quantity, 0),
    [items]
  );
  const gstAmount = useMemo(
    () =>
      form.gstApplicable
        ? items.reduce((s, it) => s + (it.quantity * it.sellingPrice * it.gstPercent) / 100, 0)
        : 0,
    [items, form.gstApplicable]
  );
  const totalAmount = useMemo(
    () =>
      subtotal +
      gstAmount +
      form.installationCharges +
      form.deliveryCharges +
      form.otherCharges +
      form.extraMaterialCharges,
    [subtotal, gstAmount, form.installationCharges, form.deliveryCharges, form.otherCharges, form.extraMaterialCharges]
  );
  const balanceDue = useMemo(() => totalAmount - form.amountPaid, [totalAmount, form.amountPaid]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function inp(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const el = e.target as HTMLInputElement;
      const val =
        el.type === 'number' ? Number(el.value) :
        el.type === 'checkbox' ? el.checked :
        el.value;
      setField(field, val as FormState[typeof field]);
    };
  }

  function updateItem(index: number, field: keyof SaleItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {};
    if (!form.customerName.trim() || form.customerName.trim().length < 2)
      e.customerName = 'Name must be at least 2 characters';
    if (!/^[6-9]\d{9}$/.test(form.customerPhone))
      e.customerPhone = 'Valid 10-digit Indian mobile required';
    if (!form.employeeId) e.employeeId = 'Please select a salesperson';
    if (!form.date) e.date = 'Date is required';
    if (form.customerType === 'business' && !form.gstin.trim())
      e.gstin = 'GSTIN required for business customers';
    items.forEach((it, i) => {
      if (!it.productName.trim()) e[`item_${i}_productName`] = 'Product name required';
      if (it.sellingPrice <= 0) e[`item_${i}_sellingPrice`] = 'Price must be > 0';
      if (it.quantity < 1) e[`item_${i}_quantity`] = 'Qty must be ≥ 1';
    });
    return e;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const employee = employees.find((e) => e.id === form.employeeId);
    const technician = employees.find((e) => e.id === form.assignedTechnicianId);
    const firstItem = items[0];

    const sale: Sale = {
      id: editSale?.id ?? generateId(),
      invoiceNumber: form.invoiceNumber,
      date: form.date,
      time: form.time,
      paymentMethod: form.paymentMethod,
      employeeId: form.employeeId,
      employeeName: employee?.name ?? '',
      storeLocation: form.storeLocation,
      gstApplicable: form.gstApplicable,
      status: form.status,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      customerType: form.customerType,
      billingAddress: form.billingAddress,
      shippingAddress: form.sameAsBilling ? form.billingAddress : form.shippingAddress,
      gstin: form.gstin,
      leadSource: form.leadSource,
      pan: form.pan,
      items,
      subtotal,
      totalDiscount,
      gstAmount,
      installationCharges: form.installationCharges,
      deliveryCharges: form.deliveryCharges,
      otherCharges: form.otherCharges,
      totalAmount,
      amountPaid: form.amountPaid,
      balanceDue,
      dueDate: form.dueDate,
      installationRequired: form.installationRequired,
      installationDate: form.installationDate,
      assignedTechnicianId: form.assignedTechnicianId,
      assignedTechnicianName: technician?.name ?? '',
      installationStatus: form.installationStatus,
      extraMaterialCharges: form.extraMaterialCharges,
      amcSold: form.amcSold,
      extendedWarrantySold: form.extendedWarrantySold,
      expectedDeliveryDate: addDays(form.date, 2),
      customerSegment: detectSegment(totalAmount),
      season: detectSeason(form.date),
      salesCampaignId: form.salesCampaignId,
      targetCategory: form.targetCategory,
      // Legacy compat
      productId: firstItem?.sku ?? '',
      productName: firstItem?.productName ?? '',
      unitPrice: firstItem?.sellingPrice ?? 0,
      quantity: items.reduce((s, it) => s + it.quantity, 0),
      notes: form.notes,
    };

    if (editSale) updateSale(sale);
    else addSale(sale);
    onClose();
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <form className="form-grid" onSubmit={handleSubmit}>

      {/* ── Section 1: Basic Invoice Info ─────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Invoice Information</span>
        </div>
        <div className="form-section__body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input className="form-input form-input--readonly" type="text"
                value={form.invoiceNumber} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-status">Status</label>
              <select className="form-select" id="sale-status" value={form.status} onChange={inp('status')}>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-date">Invoice Date</label>
              <input className="form-input" id="sale-date" type="date"
                value={form.date} onChange={inp('date')} />
              {errors.date && <span className="form-error">{errors.date}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-time">Time</label>
              <input className="form-input" id="sale-time" type="time"
                value={form.time} onChange={inp('time')} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-payment">Payment Mode</label>
              <select className="form-select" id="sale-payment" value={form.paymentMethod} onChange={inp('paymentMethod')}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="emi">EMI</option>
                <option value="cheque">Cheque</option>
                <option value="bank-transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-employee">Salesperson</label>
              <select className="form-select" id="sale-employee" value={form.employeeId} onChange={inp('employeeId')}>
                <option value="">— Select Salesperson —</option>
                {salesEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                ))}
              </select>
              {errors.employeeId && <span className="form-error">{errors.employeeId}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-location">Store Location</label>
              <select className="form-select" id="sale-location" value={form.storeLocation} onChange={inp('storeLocation')}>
                <option value="Bala Tripura Arcade">Bala Tripura Arcade</option>
                <option value="Main Branch">Main Branch</option>
                <option value="East Branch">East Branch</option>
                <option value="West Branch">West Branch</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">GST Applicable?</label>
              <div className="form-check-row" style={{ paddingTop: '10px' }}>
                <input type="checkbox" id="gst-applicable" checked={form.gstApplicable}
                  onChange={(e) => setField('gstApplicable', e.target.checked)} />
                <label htmlFor="gst-applicable">Yes, apply GST on this invoice</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Customer Information ───────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Customer Information</span>
        </div>
        <div className="form-section__body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-customer">Customer Name *</label>
              <input className="form-input" id="sale-customer" type="text"
                placeholder="Full name" value={form.customerName} onChange={inp('customerName')} />
              {errors.customerName && <span className="form-error">{errors.customerName}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-phone">Mobile Number *</label>
              <input className="form-input" id="sale-phone" type="tel"
                placeholder="10-digit mobile" value={form.customerPhone} onChange={inp('customerPhone')} />
              {errors.customerPhone && <span className="form-error">{errors.customerPhone}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-email">Email</label>
              <input className="form-input" id="sale-email" type="email"
                placeholder="customer@email.com" value={form.customerEmail} onChange={inp('customerEmail')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-ctype">Customer Type</label>
              <select className="form-select" id="sale-ctype" value={form.customerType} onChange={inp('customerType')}>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-billing">Billing Address</label>
              <textarea className="form-input" id="sale-billing" rows={2}
                placeholder="Door No, Street, City, State — PIN"
                value={form.billingAddress} onChange={inp('billingAddress')}
                style={{ resize: 'vertical' }} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-shipping">Shipping / Installation Address</label>
              <div className="form-check-row" style={{ marginBottom: '6px' }}>
                <input type="checkbox" id="same-as-billing" checked={form.sameAsBilling}
                  onChange={(e) => setField('sameAsBilling', e.target.checked)} />
                <label htmlFor="same-as-billing">Same as billing address</label>
              </div>
              {!form.sameAsBilling && (
                <textarea className="form-input" id="sale-shipping" rows={2}
                  placeholder="Door No, Street, City, State — PIN"
                  value={form.shippingAddress} onChange={inp('shippingAddress')}
                  style={{ resize: 'vertical' }} />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="sale-lead">Lead Source</label>
              <select className="form-select" id="sale-lead" value={form.leadSource} onChange={inp('leadSource')}>
                <option value="walk-in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="online">Online</option>
                <option value="phone">Phone</option>
                <option value="exhibition">Exhibition</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="sale-pan">PAN (high-value invoice)</label>
              <input className="form-input" id="sale-pan" type="text"
                placeholder="ABCDE1234F" maxLength={10}
                value={form.pan} onChange={inp('pan')}
                style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          {form.customerType === 'business' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="sale-gstin">GSTIN *</label>
                <input className="form-input" id="sale-gstin" type="text"
                  placeholder="22AAAAA0000A1Z5" maxLength={15}
                  value={form.gstin} onChange={inp('gstin')}
                  style={{ textTransform: 'uppercase' }} />
                {errors.gstin && <span className="form-error">{errors.gstin}</span>}
              </div>
              <div className="form-group" />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Products ────────────────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Products ({items.length} item{items.length !== 1 ? 's' : ''})</span>
        </div>
        <div className="form-section__body">
          {items.map((item, i) => {
            const lineTotal = item.quantity * item.sellingPrice;
            const lineGst = form.gstApplicable ? (lineTotal * item.gstPercent) / 100 : 0;
            return (
              <div className="item-card" key={item.id}>
                <div className="item-card__header">
                  <span className="item-card__title">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => removeItem(i)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="item-card__body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Product Name *</label>
                      <input className="form-input" type="text" placeholder="e.g. Blue Star 1.5T 5★ Split AC"
                        value={item.productName}
                        onChange={(e) => updateItem(i, 'productName', e.target.value)} />
                      {errors[`item_${i}_productName`] && (
                        <span className="form-error">{errors[`item_${i}_productName`]}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Model Number</label>
                      <input className="form-input" type="text" placeholder="FS518YATU"
                        value={item.modelNumber}
                        onChange={(e) => updateItem(i, 'modelNumber', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">SKU / Item Code</label>
                      <input className="form-input" type="text" placeholder="BS-SP-15-5S"
                        value={item.sku}
                        onChange={(e) => updateItem(i, 'sku', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Serial Number</label>
                      <input className="form-input" type="text" placeholder="SN-XXXX-YYYY"
                        value={item.serialNumber}
                        onChange={(e) => updateItem(i, 'serialNumber', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Tonnage</label>
                      <select className="form-select" value={item.tonnage}
                        onChange={(e) => updateItem(i, 'tonnage', e.target.value)}>
                        <option value="1T">1 Ton</option>
                        <option value="1.5T">1.5 Ton</option>
                        <option value="2T">2 Ton</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">AC Type</label>
                      <select className="form-select" value={item.acType}
                        onChange={(e) => updateItem(i, 'acType', e.target.value)}>
                        <option value="split">Split AC</option>
                        <option value="window">Window AC</option>
                        <option value="cassette">Cassette AC</option>
                        <option value="tower">Tower AC</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Energy Rating</label>
                      <select className="form-select" value={item.energyRating}
                        onChange={(e) => updateItem(i, 'energyRating', e.target.value)}>
                        <option value="3 Star">3 Star</option>
                        <option value="4 Star">4 Star</option>
                        <option value="5 Star">5 Star</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Qty *</label>
                      <input className="form-input" type="number" min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                      {errors[`item_${i}_quantity`] && (
                        <span className="form-error">{errors[`item_${i}_quantity`]}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">MRP (₹)</label>
                      <input className="form-input" type="number" min={0}
                        value={item.mrp}
                        onChange={(e) => updateItem(i, 'mrp', Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Selling Price (₹) *</label>
                      <input className="form-input" type="number" min={0}
                        value={item.sellingPrice}
                        onChange={(e) => updateItem(i, 'sellingPrice', Number(e.target.value))} />
                      {errors[`item_${i}_sellingPrice`] && (
                        <span className="form-error">{errors[`item_${i}_sellingPrice`]}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Discount per unit (₹)</label>
                      <input className="form-input" type="number" min={0}
                        value={item.discount}
                        onChange={(e) => updateItem(i, 'discount', Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GST %</label>
                      <select className="form-select" value={item.gstPercent}
                        onChange={(e) => updateItem(i, 'gstPercent', Number(e.target.value))}>
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Item Cost (₹) <small style={{ color: 'var(--text-muted)' }}>(internal)</small></label>
                      <input className="form-input" type="number" min={0}
                        value={item.itemCost}
                        onChange={(e) => updateItem(i, 'itemCost', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
                <div className="item-card__total">
                  {form.gstApplicable && <span>GST: {fmt(lineGst)}</span>}
                  <span>Line Total (incl. GST): {fmt(lineTotal + lineGst)}</span>
                </div>
              </div>
            );
          })}

          <button type="button" className="add-item-btn" onClick={addItem}>
            + Add Another Item
          </button>
        </div>
      </div>

      {/* ── Section 4: Financial Breakdown ────────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Financial Breakdown</span>
        </div>
        <div className="form-section__body">
          <div className="financial-summary">
            <div className="financial-summary__row">
              <span>Subtotal (before GST)</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="financial-summary__row">
              <span>Total Discount</span><span>− {fmt(totalDiscount)}</span>
            </div>
            {form.gstApplicable && (
              <div className="financial-summary__row">
                <span>GST (CGST {fmt(gstAmount / 2)} + SGST {fmt(gstAmount / 2)})</span>
                <span>+ {fmt(gstAmount)}</span>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="inst-charges">Installation Charges (₹)</label>
              <input className="form-input" id="inst-charges" type="number" min={0}
                value={form.installationCharges} onChange={inp('installationCharges')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="del-charges">Delivery Charges (₹)</label>
              <input className="form-input" id="del-charges" type="number" min={0}
                value={form.deliveryCharges} onChange={inp('deliveryCharges')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="other-charges">Other Charges (₹)</label>
              <input className="form-input" id="other-charges" type="number" min={0}
                value={form.otherCharges} onChange={inp('otherCharges')} />
            </div>
          </div>

          <div className="financial-summary">
            <div className="financial-summary__row financial-summary__row--total">
              <span>Invoice Total</span><span>{fmt(totalAmount)}</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="amt-paid">Amount Paid (₹)</label>
              <input className="form-input" id="amt-paid" type="number" min={0} max={totalAmount}
                value={form.amountPaid} onChange={inp('amountPaid')} />
            </div>
            <div className="form-group">
              <label className="form-label">Balance Due</label>
              <div className="form-input" style={{
                background: balanceDue > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(38,194,129,0.06)',
                color: balanceDue > 0 ? 'var(--danger)' : 'var(--success)',
                fontWeight: 700,
                display: 'flex', alignItems: 'center',
              }}>
                {fmt(Math.max(0, balanceDue))}
              </div>
            </div>
            {balanceDue > 0 && (
              <div className="form-group">
                <label className="form-label" htmlFor="due-date">Payment Due Date</label>
                <input className="form-input" id="due-date" type="date"
                  value={form.dueDate} onChange={inp('dueDate')} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Installation & Service ─────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Installation & Service</span>
        </div>
        <div className="form-section__body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Installation Required?</label>
              <div className="form-check-row" style={{ paddingTop: '10px' }}>
                <input type="checkbox" id="inst-req" checked={form.installationRequired}
                  onChange={(e) => setField('installationRequired', e.target.checked)} />
                <label htmlFor="inst-req">Installation required for this sale</label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inst-status">Installation Status</label>
              <select className="form-select" id="inst-status" value={form.installationStatus}
                onChange={inp('installationStatus')}
                disabled={!form.installationRequired}>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {form.installationRequired && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="inst-date">Installation Date</label>
                  <input className="form-input" id="inst-date" type="date"
                    value={form.installationDate} onChange={inp('installationDate')} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="inst-tech">Assigned Technician</label>
                  <select className="form-select" id="inst-tech" value={form.assignedTechnicianId}
                    onChange={inp('assignedTechnicianId')}>
                    <option value="">— Select Technician —</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="mat-charges">Extra Material Charges (₹)</label>
                  <input className="form-input" id="mat-charges" type="number" min={0}
                    value={form.extraMaterialCharges} onChange={inp('extraMaterialCharges')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Value-added Services</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
                    <div className="form-check-row">
                      <input type="checkbox" id="amc-sold" checked={form.amcSold}
                        onChange={(e) => setField('amcSold', e.target.checked)} />
                      <label htmlFor="amc-sold">AMC (Annual Maintenance Contract) sold</label>
                    </div>
                    <div className="form-check-row">
                      <input type="checkbox" id="ew-sold" checked={form.extendedWarrantySold}
                        onChange={(e) => setField('extendedWarrantySold', e.target.checked)} />
                      <label htmlFor="ew-sold">Extended Warranty sold</label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Section 6: Analytics (collapsible) ────────────────────────────── */}
      <div className="form-section">
        <div className="form-section__header">
          <span className="form-section__title">Analytics & Tracking</span>
          <button type="button" className="form-section__toggle"
            onClick={() => setAnalyticsOpen((o) => !o)}>
            {analyticsOpen ? '▲ Hide' : '▼ Show'}
          </button>
        </div>

        {analyticsOpen && (
          <div className="form-section__body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expected Delivery Date</label>
                <input className="form-input form-input--readonly" type="date"
                  value={addDays(form.date, 2)} readOnly />
                <span className="form-hint">Auto-set to invoice date + 2 days</span>
              </div>
              <div className="form-group">
                <label className="form-label">Customer Segment</label>
                <input className="form-input form-input--readonly" type="text"
                  value={detectSegment(totalAmount)} readOnly />
                <span className="form-hint">Auto-computed from invoice total</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Season</label>
                <input className="form-input form-input--readonly" type="text"
                  value={detectSeason(form.date)} readOnly />
                <span className="form-hint">Auto-detected from invoice date</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="campaign-id">Sales Campaign ID</label>
                <input className="form-input" id="campaign-id" type="text"
                  placeholder="e.g. SUMMER-2025"
                  value={form.salesCampaignId} onChange={inp('salesCampaignId')} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="target-cat">Sales Target Category</label>
                <select className="form-select" id="target-cat" value={form.targetCategory}
                  onChange={inp('targetCategory')}>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="corporate">Corporate</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <div className="form-group" />
            </div>
          </div>
        )}
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label" htmlFor="sale-notes">Notes (optional)</label>
        <textarea className="form-input" id="sale-notes" rows={2}
          placeholder="Any remarks or special instructions…"
          value={form.notes} onChange={inp('notes')}
          style={{ resize: 'vertical' }} />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary">
          {editSale ? 'Update Sale' : `Create Invoice — ${fmt(totalAmount)}`}
        </button>
      </div>
    </form>
  );
}

