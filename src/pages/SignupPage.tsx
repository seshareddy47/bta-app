import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'sales' as UserRole,
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = signup(form.name, form.email, form.password, form.role);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Signup failed');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-brand-icon">❄️</span>
          <h1>Bala Tripura Arcade</h1>
          <p>Create Account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              className="form-input"
              id="signup-name"
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={set('name')}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email Address</label>
            <input
              className="form-input"
              id="signup-email"
              type="email"
              placeholder="you@bluestar.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-role">Role</label>
            <select
              className="form-select"
              id="signup-role"
              value={form.role}
              onChange={set('role')}
            >
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              className="form-input"
              id="signup-password"
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
            <input
              className="form-input"
              id="signup-confirm"
              type="password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="form-error" style={{ marginBottom: '12px' }}>{error}</p>}
          <button
            className="btn btn--primary"
            type="submit"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
