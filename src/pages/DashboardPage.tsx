import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatRupees } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import {
  IconSales, IconCalendar, IconShoppingBag, IconEmployees, IconPackage,
  IconUser, IconReports,
} from '../components/Icons';

export function DashboardPage() {
  const { sales, employees, stocks } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const totalRevenue = sales
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter((s) => s.date.startsWith(thisMonth) && s.status === 'completed');
  const monthRevenue = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);

  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const lowStockCount = stocks.filter((s) => s.quantity <= s.minStock).length;
  const outOfStockCount = stocks.filter((s) => s.quantity === 0).length;

  const recentSales = [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{greet()}, {user?.name}</h1>
          <p className="page-subtitle">Here's what's happening at Bala Tripura Arcade today.</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-card--primary">
          <span className="stat-card__icon"><IconSales /></span>
          <div>
            <p className="stat-card__label">Total Revenue</p>
            <p className="stat-card__value">{formatRupees(totalRevenue)}</p>
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__icon"><IconCalendar /></span>
          <div>
            <p className="stat-card__label">This Month</p>
            <p className="stat-card__value">{formatRupees(monthRevenue)}</p>
          </div>
        </div>
        <div className="stat-card stat-card--info">
          <span className="stat-card__icon"><IconShoppingBag /></span>
          <div>
            <p className="stat-card__label">Total Sales</p>
            <p className="stat-card__value">{sales.filter((s) => s.status === 'completed').length}</p>
          </div>
        </div>
        <div className="stat-card stat-card--info">
          <span className="stat-card__icon"><IconEmployees /></span>
          <div>
            <p className="stat-card__label">Active Staff</p>
            <p className="stat-card__value">{activeEmployees}</p>
          </div>
        </div>
        <div className={`stat-card ${lowStockCount > 0 ? 'stat-card--warning' : 'stat-card--success'}`}>
          <span className="stat-card__icon"><IconPackage /></span>
          <div>
            <p className="stat-card__label">Stock Alerts</p>
            <p className="stat-card__value" style={{ color: lowStockCount > 0 ? 'var(--warning)' : undefined }}>
              {lowStockCount} low{outOfStockCount > 0 ? `, ${outOfStockCount} out` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Sales */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Recent Sales</h3>
            <button className="btn btn--secondary btn--sm" onClick={() => navigate('/sales')}>
              View All
            </button>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No sales yet
                    </td>
                  </tr>
                ) : (
                  recentSales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.customerName}</td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productName}</td>
                      <td><strong>{formatRupees(s.totalAmount)}</strong></td>
                      <td>
                        <span className={`badge ${s.status === 'completed' ? 'badge--success' : s.status === 'pending' ? 'badge--warning' : 'badge--danger'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Quick Actions</h3>
          </div>
          <div className="card__body">
            <div className="quick-actions">
              <button className="quick-action-btn" onClick={() => navigate('/sales')}>
                <span><IconSales /></span>
                <span>New Sale</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate('/employees')}>
                <span><IconUser /></span>
                <span>Add Employee</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate('/stocks')}>
                <span><IconPackage /></span>
                <span>Add Stock</span>
              </button>
              <button className="quick-action-btn" onClick={() => navigate('/reports')}>
                <span><IconReports /></span>
                <span>View Reports</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
