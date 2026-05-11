import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { sentrySetUser, sentryClearUser, captureError } from '@/lib/sentry';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string | null;
};

type ProfileUpdates = {
  firstName?: string;
  lastName?: string;
  birthday?: string;
};

type AuthContextType = {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (firstName: string, lastName: string, email: string, password: string, birthday: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: ProfileUpdates) => Promise<{ success: boolean; error?: string }>;
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
        sentrySetUser(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      (async () => {
        if (newSession?.user) {
          // On first sign-in after email confirmation, ensure the profile row exists.
          // birthday may have been stored in user_metadata during signUp.
          if (event === 'SIGNED_IN') {
            const meta = newSession.user.user_metadata ?? {};
            const birthdayMeta: string | undefined = meta.birthday;
            await supabase.from('user_profiles').upsert({
              id: newSession.user.id,
              ...(birthdayMeta ? { birthday: birthdayMeta } : {}),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id', ignoreDuplicates: true });
          }
          const birthday = await fetchBirthday(newSession.user.id);
          setSession(newSession);
          setUser(buildProfile(newSession.user, birthday));
          sentrySetUser(newSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          sentryClearUser();
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
      // Not a crash — expected user errors, capture only unexpected ones
      if (!msg.toLowerCase().includes('invalid') && !msg.toLowerCase().includes('not confirmed')) {
        captureError(error, { action: 'login' });
      }
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
        return { success: false, error: 'Please confirm your email address before signing in.' };
      }
      return { success: false, error: msg };
    }
    if (data.user) {
      const birthday = await fetchBirthday(data.user.id);
      setSession(data.session);
      setUser(buildProfile(data.user, birthday));
      sentrySetUser(data.user.id);
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
      options: { data: { first_name: firstName, last_name: lastName, birthday } },
    });
    if (error) {
      console.error('[register] supabase.auth.signUp error:', error.message, error);
      return { success: false, error: error.message };
    }

    // When email confirmation is required, data.session is null and auth.uid()
    // is null — the user_profiles RLS INSERT policy (auth.uid() = id) would
    // block the upsert. Only write the profile row when we have a live session.
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: data.user.id,
        birthday,
        updated_at: new Date().toISOString(),
      });
      if (profileError) {
        console.warn('[register] profile upsert error (non-fatal):', profileError.message);
      }
      setSession(data.session);
      setUser(buildProfile(data.user, birthday));
    }

    // signUp itself succeeded — user will confirm email before first login
    return { success: true };
  }, []);

  const updateProfile = useCallback(async (
    updates: ProfileUpdates,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Save firstName/lastName to Supabase auth user_metadata.
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...(updates.firstName !== undefined ? { first_name: updates.firstName } : {}),
          ...(updates.lastName !== undefined ? { last_name: updates.lastName } : {}),
        },
      });
      if (authError) return { success: false, error: authError.message };
    }

    // Save birthday (and any future profile-table fields) to user_profiles.
    if (updates.birthday !== undefined) {
      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        birthday: updates.birthday,
        updated_at: new Date().toISOString(),
      });
      if (error) return { success: false, error: error.message };
    }

    setUser((prev) => prev ? {
      ...prev,
      ...(updates.firstName !== undefined ? { firstName: updates.firstName } : {}),
      ...(updates.lastName !== undefined ? { lastName: updates.lastName } : {}),
      ...(updates.birthday !== undefined ? { birthday: updates.birthday } : {}),
    } : prev);
    return { success: true };
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    sentryClearUser();
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
