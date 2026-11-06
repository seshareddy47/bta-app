import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string, fallbackEmail: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, name, email, role, active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  if (data.role !== 'admin' && data.role !== 'service') {
    console.error('Unsupported staff role:', data.role);
    return null;
  }
  return {
    id: data.id,
    name: data.name,
    email: data.email ?? fallbackEmail,
    role: data.role,
    active: data.active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Applies a loaded profile, signing out if the account is missing or disabled.
  async function applyProfile(userId: string, email: string) {
    const profile = await loadProfile(userId, email);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      return;
    }
    setUser(profile);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await applyProfile(session.user.id, session.user.email ?? '');
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void applyProfile(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) return { success: false, error: error?.message ?? 'Invalid email or password' };
    const profile = await loadProfile(data.user.id, data.user.email ?? '');
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      return { success: false, error: 'This account is disabled. Contact an admin.' };
    }
    setUser(profile);
    return { success: true };
  }

  // The database creates inactive service accounts; only an admin can promote or activate them.
  async function signup(name: string, email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'Signup failed' };
    if (!data.session) {
      // No session was issued (e.g. the project requires email confirmation) — the account
      // exists but there's nothing to authenticate API calls with yet. Treating this as a
      // successful login would leave the UI showing "signed in" while every request is
      // actually sent unauthenticated and gets rejected with 401.
      return {
        success: false,
        error: 'Account created. Please check your email to confirm it before signing in.',
      };
    }
    // New accounts always start inactive/lowest-privilege until an admin approves them (see
    // handle_new_user() in 0001_init.sql) — mirror login()'s inactive handling rather than
    // pretending the user is authenticated when they aren't yet approved.
    const profile = await loadProfile(data.user.id, normalizedEmail);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      setUser(null);
      return {
        success: false,
        error: 'Account created. An admin must activate your account before you can sign in.',
      };
    }
    setUser(profile);
    return { success: true };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
