import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

export type NetworkStatus = 'online' | 'offline';

// How many consecutive failed pings before we declare offline
const OFFLINE_CONFIRM_COUNT = 2;
// How long to wait after getting back online before hiding the banner
const RECONNECT_HIDE_DELAY_MS = 1500;
// Ping interval when we believe we're online
const PING_INTERVAL_ONLINE_MS = 30000;
// Faster polling while offline to detect recovery quickly
const PING_INTERVAL_OFFLINE_MS = 8000;
// Each ping must complete within this timeout
const PING_TIMEOUT_MS = 6000;

// Ping the app's own Supabase URL rather than an external service, so we
// don't falsely go offline when a third-party CDN is unreachable.
function getPingUrl(): string {
  const base =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_SUPABASE_URL
      : undefined;
  // A lightweight path that always returns quickly — just the health endpoint
  if (base) return `${base}/rest/v1/`;
  // Absolute fallback: a reliable, CORS-permissive Google endpoint
  return 'https://www.gstatic.com/generate_204';
}

async function probeFetch(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    await fetch(getPingUrl(), {
      method: 'HEAD',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useNetworkStatus() {
  // Start optimistic — assume online until proven otherwise.
  // This prevents the banner from flashing on every cold start.
  const [status, setStatus] = useState<NetworkStatus>('online');

  // Track consecutive failures without triggering re-renders
  const failCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const scheduleInterval = useCallback((ms: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(probe, ms);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const probe = useCallback(async () => {
    if (!mounted.current) return;

    // On web, trust the browser's navigator.onLine === false as an immediate
    // signal, but still require a failed probe to confirm before showing banner.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
      failCount.current += 1;
    } else {
      const reachable = await probeFetch();
      if (!mounted.current) return;
      if (reachable) {
        failCount.current = 0;
      } else {
        failCount.current += 1;
      }
    }

    if (!mounted.current) return;

    if (failCount.current >= OFFLINE_CONFIRM_COUNT) {
      // Confirmed offline
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      setStatus('offline');
      // Poll more aggressively to detect recovery
      scheduleInterval(PING_INTERVAL_OFFLINE_MS);
    } else if (failCount.current === 0) {
      // Confirmed online
      if (status === 'offline') {
        // Small grace period before hiding the banner so it doesn't flicker
        reconnectTimer.current = setTimeout(() => {
          if (mounted.current) setStatus('online');
        }, RECONNECT_HIDE_DELAY_MS);
      } else {
        setStatus('online');
      }
      scheduleInterval(PING_INTERVAL_ONLINE_MS);
    }
    // failCount === 1: first failure — don't change status yet, wait for confirmation
  }, [status, scheduleInterval]);

  // Manual retry exposed for retry buttons in the UI
  const retry = useCallback(async () => {
    failCount.current = 0;
    await probe();
  }, [probe]);

  useEffect(() => {
    mounted.current = true;

    // Don't probe immediately on mount — wait a short moment so the app
    // renders its first frame before any network work begins.
    const initTimer = setTimeout(() => {
      probe();
      scheduleInterval(PING_INTERVAL_ONLINE_MS);
    }, 2000);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onOnline = () => {
        // Browser says we're back — do a real probe to confirm
        failCount.current = 0;
        probe();
      };
      const onOffline = () => {
        // Browser says we're offline — increment but still confirm via probe
        failCount.current += 1;
        probe();
      };
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);

      return () => {
        mounted.current = false;
        clearTimeout(initTimer);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    return () => {
      mounted.current = false;
      clearTimeout(initTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isOffline: status === 'offline',
    retry,
  };
}
