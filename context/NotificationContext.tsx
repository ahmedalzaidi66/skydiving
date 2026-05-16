import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type NotificationType =
  | 'order_update'
  | 'gear_approved'
  | 'gear_rejected'
  | 'price_drop'
  | 'announcement'
  | 'report_update'
  | 'campaign';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

type NotificationContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as AppNotification[]);
    setLoading(false);
  }, [user]);

  // Initial load + reload when user changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!user) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? { ...n, ...(payload.new as AppNotification) } : n))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markRead,
      markAllRead,
      refresh: fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
