import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { formatRupees, formatDate } from '../../utils/helpers';
import { AddStockForm } from '../forms/AddStockForm';
import { IconEdit, IconTrash, IconWarning } from '../Icons';
import type { Stock, AcCategory } from '../../types';

const CATEGORY_LABELS: Record<AcCategory, string> = {
  'split-ac': 'Split AC',
  'window-ac': 'Window AC',
  'cassette-ac': 'Cassette AC',
  'tower-ac': 'Tower AC',
};

function StockQtyCell({ quantity, minStock }: { quantity: number; minStock: number }) {
  const cls =
    quantity === 0 ? 'stock-cell--out'
    : quantity <= minStock ? 'stock-cell--low'
    : 'stock-cell--ok';
  return <span className={`stock-cell ${cls}`}>{quantity}</span>;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="star-display" title={`${rating} Star`}>
      {'★'.repeat(rating)}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export function StockTable() {
  const { stocks, deleteStock } = useData();
  const [editStock, setEditStock] = useState<Stock | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<AcCategory | 'all'>('all');

  const lowCount = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.minStock).length;
  const outCount = stocks.filter((s) => s.quantity === 0).length;

  const filtered = stocks
    .filter((s) => filterCat === 'all' || s.category === filterCat)
    .filter((s) =>
      !search ||
      s.productName.toLowerCase().includes(search.toLowerCase()) ||
      s.sku.toLowerCase().includes(search.toLowerCase()) ||
      s.modelNumber.toLowerCase().includes(search.toLowerCase())
    );

  if (editStock) {
    return (
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Edit Stock Item</h3>
        </div>
        <div className="card__body">
          <AddStockForm editStock={editStock} onClose={() => setEditStock(null)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {(lowCount > 0 || outCount > 0) && (
        <div className="stock-alerts">
          {outCount > 0 && (
            <div className="alert alert--danger">
              <IconWarning /> <strong>{outCount} product{outCount > 1 ? 's' : ''}</strong> out of stock
            </div>
          )}
          {lowCount > 0 && (
            <div className="alert alert--warning">
              <IconWarning /> <strong>{lowCount} product{lowCount > 1 ? 's' : ''}</strong> running low
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Inventory</h3>
          <span className="badge badge--primary">{filtered.length} products</span>
        </div>
        <div className="card__body">
          <div className="table-controls">
            <input
              className="form-input"
              type="search"
              placeholder="Search product, SKU, model…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '260px' }}
            />
            <div className="filter-tabs">
              {(['all', 'split-ac', 'window-ac', 'cassette-ac', 'tower-ac'] as const).map((f) => (
                <button
                  key={f}
                  className={`filter-tab${filterCat === f ? ' filter-tab--active' : ''}`}
                  onClick={() => setFilterCat(f)}
                >
                  {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Tonnage</th>
                  <th>Rating</th>
                  <th>MRP</th>
                  <th>In Stock</th>
                  <th>Min</th>
                  <th>Location</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                      No products found
                    </td>
                  </tr>
                ) : (
                  filtered.map((stock) => (
                    <tr key={stock.id}>
                      <td><code className="sku-code">{stock.sku}</code></td>
                      <td><strong>{stock.productName}</strong><br /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stock.modelNumber}</span></td>
                      <td>{CATEGORY_LABELS[stock.category]}</td>
                      <td>{stock.tonnage}</td>
                      <td><StarDisplay rating={stock.starRating} /></td>
                      <td>{formatRupees(stock.price)}</td>
                      <td><StockQtyCell quantity={stock.quantity} minStock={stock.minStock} /></td>
                      <td>{stock.minStock}</td>
                      <td>{stock.location}</td>
                      <td>{formatDate(stock.lastUpdated)}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn btn--secondary btn--sm" onClick={() => setEditStock(stock)}><IconEdit /></button>
                          <button className="btn btn--danger btn--sm" onClick={() => {
                            if (confirm(`Delete ${stock.productName}?`)) deleteStock(stock.id);
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
    </div>
  );
}
