import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string | null; // ISO date string YYYY-MM-DD
};

type AuthContextType = {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (firstName: string, lastName: string, email: string, password: string, birthday: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: { birthday?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const birthday = await fetchBirthday(data.session.user.id);
        setUser(buildProfile(data.session.user, birthday));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (session?.user) {
          const birthday = await fetchBirthday(session.user.id);
          setUser(buildProfile(session.user, birthday));
        } else {
          setUser(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      const msg = error.message ?? '';
      if (
        msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('not confirmed')
      ) {
        return {
          success: false,
          error: 'Email confirmation is enabled in Supabase. Disable Confirm email or confirm the user.',
        };
      }
      return { success: false, error: msg };
    }
    if (data.user) {
      const birthday = await fetchBirthday(data.user.id);
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
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    if (error) return { success: false, error: error.message };

    if (data.user) {
      await supabase.from('user_profiles').upsert({
        id: data.user.id,
        birthday,
        updated_at: new Date().toISOString(),
      });
      setUser(buildProfile(data.user, birthday));
    }
    return { success: true };
  }, []);

  const updateProfile = useCallback(async (
    updates: { birthday?: string }
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
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
