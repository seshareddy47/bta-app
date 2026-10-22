import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { generateId } from '../utils/helpers';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (name: string, email: string, password: string, role: UserRole) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USERS_KEY = 'bta_users';
const SESSION_KEY = 'bta_session';

const DEFAULT_ADMIN: User = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@bluestar.com',
  role: 'admin',
  passwordHash: btoa('admin123'),
};

function getStoredUsers(): User[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [DEFAULT_ADMIN];
  const users: User[] = JSON.parse(raw);
  // ensure default admin always exists
  if (!users.find((u) => u.email === DEFAULT_ADMIN.email)) {
    users.unshift(DEFAULT_ADMIN);
  }
  return users;
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  });

  function login(email: string, password: string) {
    const users = getStoredUsers();
    const found = users.find(
      (u) => u.email === email.trim().toLowerCase() && u.passwordHash === btoa(password)
    );
    if (!found) return { success: false, error: 'Invalid email or password' };
    setUser(found);
    localStorage.setItem(SESSION_KEY, JSON.stringify(found));
    return { success: true };
  }

  function signup(name: string, email: string, password: string, role: UserRole) {
    const users = getStoredUsers();
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((u) => u.email === normalizedEmail)) {
      return { success: false, error: 'Email already registered' };
    }
    const newUser: User = {
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      role,
      passwordHash: btoa(password),
    };
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
