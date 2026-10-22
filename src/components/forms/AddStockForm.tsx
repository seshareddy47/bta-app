import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { generateId, generateSku, today } from '../../utils/helpers';
import type { Stock, AcCategory, AcTonnage, StarRating } from '../../types';

interface Props {
  onClose: () => void;
  editStock?: Stock;
}

export function AddStockForm({ onClose, editStock }: Props) {
  const { addStock, updateStock } = useData();

  const [form, setForm] = useState({
    productName: editStock?.productName ?? '',
    sku: editStock?.sku ?? '',
    category: (editStock?.category ?? 'split-ac') as AcCategory,
    tonnage: (editStock?.tonnage ?? '1.5T') as AcTonnage,
    starRating: (editStock?.starRating ?? 5) as StarRating,
    modelNumber: editStock?.modelNumber ?? '',
    price: editStock?.price ?? 0,
    quantity: editStock?.quantity ?? 0,
    minStock: editStock?.minStock ?? 3,
    location: editStock?.location ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const raw = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: raw } as typeof form;
        // auto-update SKU when category/tonnage/starRating changes
        if (['category', 'tonnage', 'starRating'].includes(field)) {
          const cat = field === 'category' ? (raw as AcCategory) : prev.category;
          const ton = field === 'tonnage' ? (raw as AcTonnage) : prev.tonnage;
          const star = field === 'starRating' ? (Number(raw) as StarRating) : prev.starRating;
          next.sku = generateSku(cat, ton, star);
        }
        if (field === 'category' || field === 'tonnage' || field === 'starRating') {
          const cat = field === 'category' ? (raw as AcCategory) : prev.category;
          const ton = field === 'tonnage' ? (raw as AcTonnage) : prev.tonnage;
          const star = field === 'starRating' ? (Number(raw) as StarRating) : prev.starRating;
          const catLabel = { 'split-ac': 'Split', 'window-ac': 'Window', 'cassette-ac': 'Cassette', 'tower-ac': 'Tower' }[cat];
          next.productName = `Blue Star ${ton} ${star}★ ${catLabel} AC`;
        }
        return next;
      });
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.productName.trim()) e.productName = 'Product name is required';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    if (!form.modelNumber.trim()) e.modelNumber = 'Model number is required';
    if (form.price <= 0) e.price = 'Price must be greater than 0';
    if (form.quantity < 0) e.quantity = 'Quantity cannot be negative';
    if (!form.location.trim()) e.location = 'Location is required';
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const stock: Stock = {
      id: editStock?.id ?? generateId(),
      ...form,
      lastUpdated: today(),
    };

    if (editStock) updateStock(stock);
    else addStock(stock);
    onClose();
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="stk-category">Category</label>
          <select className="form-select" id="stk-category" value={form.category} onChange={set('category')}>
            <option value="split-ac">Split AC</option>
            <option value="window-ac">Window AC</option>
            <option value="cassette-ac">Cassette AC</option>
            <option value="tower-ac">Tower AC</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="stk-tonnage">Tonnage</label>
          <select className="form-select" id="stk-tonnage" value={form.tonnage} onChange={set('tonnage')}>
            <option value="1T">1 Ton</option>
            <option value="1.5T">1.5 Ton</option>
            <option value="2T">2 Ton</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="stk-star">Star Rating</label>
          <select className="form-select" id="stk-star" value={form.starRating} onChange={set('starRating')}>
            <option value={3}>3 Star ★★★</option>
            <option value={4}>4 Star ★★★★</option>
            <option value={5}>5 Star ★★★★★</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="stk-sku">SKU</label>
          <input className="form-input" id="stk-sku" type="text"
            placeholder="Auto-generated" value={form.sku} onChange={set('sku')} />
          {errors.sku && <span className="form-error">{errors.sku}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label" htmlFor="stk-name">Product Name</label>
          <input className="form-input" id="stk-name" type="text"
            placeholder="Product name" value={form.productName} onChange={set('productName')} />
          {errors.productName && <span className="form-error">{errors.productName}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="stk-model">Model Number</label>
          <input className="form-input" id="stk-model" type="text"
            placeholder="e.g. FS518YATU" value={form.modelNumber} onChange={set('modelNumber')} />
          {errors.modelNumber && <span className="form-error">{errors.modelNumber}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="stk-price">MRP (₹)</label>
          <input className="form-input" id="stk-price" type="number"
            min={1} placeholder="e.g. 58000" value={form.price} onChange={set('price')} />
          {errors.price && <span className="form-error">{errors.price}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="stk-qty">Initial Quantity</label>
          <input className="form-input" id="stk-qty" type="number"
            min={0} placeholder="Units in stock" value={form.quantity} onChange={set('quantity')} />
          {errors.quantity && <span className="form-error">{errors.quantity}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="stk-min">Min Stock Threshold</label>
          <input className="form-input" id="stk-min" type="number"
            min={0} placeholder="Low-stock alert level" value={form.minStock} onChange={set('minStock')} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="stk-location">Location</label>
          <input className="form-input" id="stk-location" type="text"
            placeholder="e.g. Rack A-1" value={form.location} onChange={set('location')} />
          {errors.location && <span className="form-error">{errors.location}</span>}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary">
          {editStock ? 'Update Stock' : 'Add Product'}
        </button>
      </div>
    </form>
  );
}
