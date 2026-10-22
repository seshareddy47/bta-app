import { useState } from 'react';
import { useData } from '../context/DataContext';
import { StockTable } from '../components/tables/StockTable';
import { AddStockForm } from '../components/forms/AddStockForm';
import { formatRupees } from '../utils/helpers';
import { IconPackage, IconGem, IconZap, IconBan } from '../components/Icons';

type Tab = 'table' | 'add';

export function StocksPage() {
  const [tab, setTab] = useState<Tab>('table');
  const { stocks } = useData();

  const totalProducts = stocks.length;
  const totalValue = stocks.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const lowStock = stocks.filter((s) => s.quantity > 0 && s.quantity <= s.minStock).length;
  const outOfStock = stocks.filter((s) => s.quantity === 0).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stocks</h1>
          <p className="page-subtitle">Track AC inventory and product availability</p>
        </div>
        <div className="page-header-actions">
          <button
            className={`btn ${tab === 'add' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTab((t) => (t === 'add' ? 'table' : 'add'))}
          >
            {tab === 'add' ? '← Back to Table' : '+ Add Product'}
          </button>
        </div>
      </div>

      {tab === 'table' && (
        <div className="stats-grid stats-grid--sm">
          <div className="stat-card stat-card--primary">
            <span className="stat-card__icon"><IconPackage /></span>
            <div>
              <p className="stat-card__label">Products</p>
              <p className="stat-card__value">{totalProducts}</p>
            </div>
          </div>
          <div className="stat-card stat-card--info">
            <span className="stat-card__icon"><IconGem /></span>
            <div>
              <p className="stat-card__label">Inventory Value</p>
              <p className="stat-card__value">{formatRupees(totalValue)}</p>
            </div>
          </div>
          <div className="stat-card stat-card--warning">
            <span className="stat-card__icon"><IconZap /></span>
            <div>
              <p className="stat-card__label">Low Stock</p>
              <p className="stat-card__value" style={{ color: lowStock > 0 ? 'var(--warning)' : undefined }}>
                {lowStock}
              </p>
            </div>
          </div>
          <div className="stat-card stat-card--danger">
            <span className="stat-card__icon"><IconBan /></span>
            <div>
              <p className="stat-card__label">Out of Stock</p>
              <p className="stat-card__value" style={{ color: outOfStock > 0 ? 'var(--danger)' : undefined }}>
                {outOfStock}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'add' ? (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Add Product</h3>
          </div>
          <div className="card__body">
            <AddStockForm onClose={() => setTab('table')} />
          </div>
        </div>
      ) : (
        <StockTable />
      )}
    </div>
  );
}
