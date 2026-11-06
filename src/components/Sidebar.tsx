import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import logo from '../assets/logo.png';
import {
  IconDashboard, IconSales, IconEmployees, IconPackage, IconReports, IconLogout, IconService,
} from './Icons';

const NAV_ITEMS: { path: string; label: string; icon: ReactNode; roles?: UserRole[] }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { path: '/sales', label: 'Sales', icon: <IconSales />, roles: ['admin'] },
  { path: '/employees', label: 'Employees', icon: <IconEmployees />, roles: ['admin'] },
  { path: '/stocks', label: 'Stocks', icon: <IconPackage />, roles: ['admin'] },
  { path: '/services', label: 'Service', icon: <IconService />, roles: ['admin', 'service'] },
  { path: '/reports', label: 'Reports', icon: <IconReports />, roles: ['admin'] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img className="sidebar__logo-image" src={logo} alt="" />
        <div>
          <span className="sidebar__logo-brand">Bala Tripura Arcade</span>
          <span className="sidebar__logo-sub">Shop Manager</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
            }
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="sidebar__user-avatar">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </span>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">{user?.name}</span>
            <span className="sidebar__user-role">{user?.role}</span>
          </div>
        </div>
        <button className="sidebar__logout-btn" onClick={handleLogout} title="Logout">
          <IconLogout />
        </button>
      </div>
    </aside>
  );
}
