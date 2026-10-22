import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { formatRupees, formatDate } from '../../utils/helpers';
import { AddSaleForm } from '../forms/AddSaleForm';
import { IconEdit, IconTrash } from '../Icons';
import type { Sale, SaleStatus } from '../../types';

const STATUS_BADGE: Record<SaleStatus, string> = {
  completed: 'badge--success',
  pending: 'badge--warning',
  cancelled: 'badge--danger',
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  completed: 'Completed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

export function SalesTable() {
  const { sales, deleteSale } = useData();
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SaleStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<'date' | 'totalAmount' | 'customerName'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const filtered = sales
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const productName = s.items?.[0]?.productName ?? s.productName;
      return (
        s.customerName.toLowerCase().includes(q) ||
        productName.toLowerCase().includes(q) ||
        s.employeeName.toLowerCase().includes(q) ||
        (s.invoiceNumber ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') return a.date.localeCompare(b.date) * mul;
      if (sortKey === 'totalAmount') return (a.totalAmount - b.totalAmount) * mul;
      return a.customerName.localeCompare(b.customerName) * mul;
    });

  if (editSale) {
    return (
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Edit Sale</h3>
        </div>
        <div className="card__body">
          <AddSaleForm editSale={editSale} onClose={() => setEditSale(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Sales Records</h3>
        <span className="badge badge--primary">{filtered.length} records</span>
      </div>
      <div className="card__body">
        <div className="table-controls">
          <input
            className="form-input"
            type="search"
            placeholder="Search customer, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '260px' }}
          />
          <div className="filter-tabs">
            {(['all', 'completed', 'pending', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                className={`filter-tab${filter === f ? ' filter-tab--active' : ''}`}
                onClick={() => setFilter(f)}
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
                <th>#</th>
                <th>Invoice</th>
                <th className="sortable" onClick={() => toggleSort('date')}>
                  Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="sortable" onClick={() => toggleSort('customerName')}>
                  Customer {sortKey === 'customerName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Product</th>
                <th>Qty</th>
                <th className="sortable" onClick={() => toggleSort('totalAmount')}>
                  Amount {sortKey === 'totalAmount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Employee</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No sales found
                  </td>
                </tr>
              ) : (
                filtered.map((sale, i) => (
                  <tr key={sale.id}>
                    <td>{i + 1}</td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary)' }}>
                        {sale.invoiceNumber ?? '—'}
                      </div>
                    </td>
                    <td>{formatDate(sale.date)}</td>
                    <td>
                      <div>{sale.customerName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sale.customerPhone}</div>
                    </td>
                    <td>
                      <div>{sale.items?.[0]?.productName ?? sale.productName}</div>
                      {sale.items?.length > 1 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{sale.items.length - 1} more</div>
                      )}
                    </td>
                    <td>{sale.items?.reduce((s, it) => s + it.quantity, 0) ?? sale.quantity}</td>
                    <td><strong>{formatRupees(sale.totalAmount)}</strong></td>
                    <td>{sale.employeeName}</td>
                    <td>
                      <span className="badge badge--primary" style={{ textTransform: 'uppercase', fontSize: '11px' }}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[sale.status]}`}>
                        {STATUS_LABELS[sale.status]}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--secondary btn--sm" onClick={() => setEditSale(sale)}><IconEdit /></button>
                        <button className="btn btn--danger btn--sm" onClick={() => {
                          if (confirm('Delete this sale?')) deleteSale(sale.id);
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
