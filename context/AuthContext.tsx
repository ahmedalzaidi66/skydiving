import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string | null;
};

type AuthContextType = {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (firstName: string, lastName: string, email: string, password: string, birthday: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: { birthday?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildProfile(supabaseUser: any, birthday: string | null = null): UserProfile {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    firstName: meta.first_name ?? '',
    lastName: meta.last_name ?? '',
    birthday,
  };
}

async function fetchBirthday(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('birthday')
    .eq('id', userId)
    .maybeSingle();
  return data?.birthday ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const birthday = await fetchBirthday(data.session.user.id);
        setSession(data.session);
        setUser(buildProfile(data.session.user, birthday));
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (newSession?.user) {
          const birthday = await fetchBirthday(newSession.user.id);
          setSession(newSession);
          setUser(buildProfile(newSession.user, birthday));
        } else {
          setSession(null);
          setUser(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const msg = error.message ?? '';
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
        return { success: false, error: 'Please confirm your email address before signing in.' };
      }
      return { success: false, error: msg };
    }
    if (data.user) {
      const birthday = await fetchBirthday(data.user.id);
      setSession(data.session);
      setUser(buildProfile(data.user, birthday));
    }
    return { success: true };
  }, []);

  const register = useCallback(async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    birthday: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    if (error) return { success: false, error: error.message };

    // Save birthday whenever a user row was created — even when email
    // confirmation is required (data.session will be null in that case, but
    // data.user is always present on a successful signUp).
    if (data.user) {
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: data.user.id,
        birthday,
        updated_at: new Date().toISOString(),
      });
      if (profileError) return { success: false, error: profileError.message };

      if (data.session) {
        setSession(data.session);
        setUser(buildProfile(data.user, birthday));
      }
    }
    return { success: true };
  }, []);

  const updateProfile = useCallback(async (
    updates: { birthday?: string },
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      ...updates,
      updated_at: new Date().toISOString(),
    });
    if (error) return { success: false, error: error.message };
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
    return { success: true };
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (
    email: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectTo = origin ? `${origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const resetPassword = useCallback(async (
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, loading, isAuthenticated: !!user,
      login, register, updateProfile, logout, forgotPassword, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
