---
name: auth-flow
description: "Use when: implementing login, signup, logout, or route protection in the Blue Star AC Shop Management System. Covers AuthContext with localStorage persistence, LoginForm and SignupForm validation rules, and the ProtectedRoute HOC pattern. Load when working on any authentication or authorization feature."
---

# Auth Flow

## When to Use
- Building the login or signup page
- Protecting routes behind authentication
- Adding logout functionality
- Accessing current user info in any component

## User Model

```typescript
// src/types/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'sales';
  passwordHash: string; // bcrypt-style: in this local app, use btoa(password) as simple encoding
}
```

> **Note**: This app uses localStorage only (no backend). Passwords are stored as **base64-encoded** strings (`btoa(password)`). This is NOT secure for production — it is intentional for a local shop management demo. Never expose sensitive data.

## AuthContext Pattern

```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (name: string, email: string, password: string, role: User['role']) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'bta_users';
const SESSION_KEY = 'bta_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  });

  function getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_ADMIN];
    return JSON.parse(raw);
  }

  function saveUsers(users: User[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  function login(email: string, password: string) {
    const users = getUsers();
    const found = users.find(u => u.email === email && u.passwordHash === btoa(password));
    if (!found) return { success: false, error: 'Invalid email or password' };
    const { passwordHash: _, ...safeUser } = found;
    const sessionUser = { ...found };
    setUser(sessionUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true };
  }

  function signup(name: string, email: string, password: string, role: User['role']) {
    const users = getUsers();
    if (users.some(u => u.email === email)) {
      return { success: false, error: 'Email already registered' };
    }
    const newUser: User = { id: crypto.randomUUID(), name, email, role, passwordHash: btoa(password) };
    saveUsers([...users, newUser]);
    setUser(newUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return { success: true };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const DEFAULT_ADMIN: User = {
  id: 'admin-1', name: 'Admin', email: 'admin@bluestar.com',
  role: 'admin', passwordHash: btoa('admin123'),
};
```

## ProtectedRoute HOC

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

## LoginForm Fields & Validation

| Field | Type | Validation |
|-------|------|-----------|
| Email | email | Required, valid email format |
| Password | password | Required, min 6 chars |

```tsx
// src/pages/LoginPage.tsx – minimal structure
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = login(email, password);
    if (result.success) navigate('/dashboard');
    else setError(result.error ?? 'Login failed');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-brand-icon">❄️</span>
          <h1>Blue Star</h1>
          <p>Shop Manager</p>
        </div>
        <form onSubmit={handleSubmit}>
          {/* .form-group fields */}
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn--primary" style={{width:'100%'}}>Sign In</button>
        </form>
        <p className="auth-switch">Don't have an account? <a href="/signup">Sign up</a></p>
      </div>
    </div>
  );
}
```

## SignupForm Additional Fields

| Field | Type | Validation |
|-------|------|-----------|
| Full Name | text | Required, min 2 chars |
| Email | email | Required, valid, not already registered |
| Role | select | Required: admin/manager/sales |
| Password | password | Required, min 6 chars |
| Confirm Password | password | Must match password |

## Auth Page CSS
```css
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); }
.auth-card { background: var(--surface); border-radius: var(--radius-lg); padding: 40px; width: 380px; box-shadow: var(--shadow-md); }
.auth-card__brand { text-align: center; margin-bottom: 28px; }
.auth-card__brand h1 { font-size: 24px; font-weight: 700; color: var(--primary); }
.auth-card__brand p { color: var(--text-muted); font-size: 14px; }
.auth-brand-icon { font-size: 40px; display: block; margin-bottom: 8px; }
.auth-switch { text-align: center; margin-top: 16px; font-size: 14px; color: var(--text-muted); }
.auth-switch a { color: var(--primary); text-decoration: none; font-weight: 500; }
```

## Route Setup in App.tsx
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  <Route path="/*" element={
    <ProtectedRoute>
      <AppShell />  {/* contains sidebar + <Outlet /> */}
    </ProtectedRoute>
  } />
</Routes>
```

## Default Credentials (seed)
- Email: `admin@bluestar.com`  
- Password: `admin123`

Always display these in the login page as a helper hint during development.

## Procedure: Implement Auth
1. Create `src/types/index.ts` with `User` interface
2. Create `src/context/AuthContext.tsx` with `AuthProvider` and `useAuth`
3. Wrap `<App>` in `<AuthProvider>` in `src/main.tsx`
4. Create `src/pages/LoginPage.tsx` using auth-card pattern above
5. Create `src/pages/SignupPage.tsx` with additional fields
6. Create `src/components/ProtectedRoute.tsx`
7. Configure routes in `App.tsx`: public `/login`, `/signup`; protected `/*`
8. Add logout button in `TopBar` that calls `useAuth().logout()` then navigates to `/login`
