import { useData } from '../context/DataContext';
import { aggregateSalesByMonth, formatRupees } from '../utils/helpers';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { IconSales, IconShoppingBag, IconReports } from '../components/Icons';

const PAYMENT_COLORS = ['#0061d5', '#26c281', '#E1AD4A', '#2486FC'];

export function ReportsPage() {
  const { sales } = useData();

  const monthlyData = aggregateSalesByMonth(sales);

  // Payment method distribution
  const paymentMap: Record<string, number> = {};
  sales.filter((s) => s.status === 'completed').forEach((s) => {
    paymentMap[s.paymentMethod] = (paymentMap[s.paymentMethod] ?? 0) + s.totalAmount;
  });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  // Top products by revenue
  const productMap: Record<string, number> = {};
  sales.filter((s) => s.status === 'completed').forEach((s) => {
    productMap[s.productName] = (productMap[s.productName] ?? 0) + s.totalAmount;
  });
  const topProducts = Object.entries(productMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, revenue]) => ({ name: name.replace('Blue Star ', ''), revenue }));

  // Top employees by sales count
  const empSalesMap: Record<string, number> = {};
  sales.filter((s) => s.status === 'completed').forEach((s) => {
    empSalesMap[s.employeeName] = (empSalesMap[s.employeeName] ?? 0) + 1;
  });
  const topEmployees = Object.entries(empSalesMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const totalRevenue = sales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Sales analytics and performance overview</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="stats-grid">
        <div className="stat-card stat-card--primary">
          <span className="stat-card__icon"><IconSales /></span>
          <div>
            <p className="stat-card__label">Total Revenue</p>
            <p className="stat-card__value">{formatRupees(totalRevenue)}</p>
          </div>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__icon"><IconShoppingBag /></span>
          <div>
            <p className="stat-card__label">Units Sold</p>
            <p className="stat-card__value">
              {sales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.quantity, 0)}
            </p>
          </div>
        </div>
        <div className="stat-card stat-card--info">
          <span className="stat-card__icon"><IconReports /></span>
          <div>
            <p className="stat-card__label">Avg Sale Value</p>
            <p className="stat-card__value">
              {formatRupees(
                sales.filter((s) => s.status === 'completed').length > 0
                  ? Math.round(totalRevenue / sales.filter((s) => s.status === 'completed').length)
                  : 0
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Bar Chart */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Monthly Revenue</h3>
        </div>
        <div className="card__body">
          {monthlyData.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No sales data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v) => [formatRupees(v as number), 'Revenue'] as [string, string]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                />
                <Bar dataKey="revenue" fill="#0061d5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="reports-grid">
        {/* Units Sold Line Chart */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Units Sold per Month</h3>
          </div>
          <div className="card__body">
            {monthlyData.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Line
                    type="monotone"
                    dataKey="units"
                    stroke="#0061d5"
                    strokeWidth={2}
                    dot={{ fill: '#0061d5', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Method Pie */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Revenue by Payment</h3>
          </div>
          <div className="card__body">
            {paymentData.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                  label={(props) => `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {paymentData.map((_, index) => (
                      <Cell key={index} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v) => formatRupees(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Top Products by Revenue</h3>
          </div>
          <div className="card__body">
            {topProducts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v) => [formatRupees(v as number), 'Revenue'] as [string, string]} />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Employees */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Top Performers</h3>
          </div>
          <div className="card__body">
            {topEmployees.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No data</p>
            ) : (
              <div className="leaderboard">
                {topEmployees.map((emp, i) => (
                  <div key={emp.name} className="leaderboard-item">
                    <span className="leaderboard-rank">{i + 1}</span>
                    <span className="leaderboard-name">{emp.name}</span>
                    <span className="badge badge--primary">{emp.count} sales</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
