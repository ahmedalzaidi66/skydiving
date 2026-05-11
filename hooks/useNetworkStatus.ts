import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type NetworkStatus = 'online' | 'offline' | 'slow';

const PING_URL = 'https://www.gstatic.com/generate_204';
const SLOW_THRESHOLD_MS = 3000;
const PING_INTERVAL_MS = 8000;

async function checkConnection(): Promise<NetworkStatus> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline';
  }
  try {
    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    await fetch(PING_URL, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    const elapsed = Date.now() - start;
    return elapsed > SLOW_THRESHOLD_MS ? 'slow' : 'online';
  } catch {
    return 'offline';
  }
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>('online');

  const ping = useCallback(async () => {
    const result = await checkConnection();
    setStatus(result);
  }, []);

  useEffect(() => {
    ping();

    const interval = setInterval(ping, PING_INTERVAL_MS);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onOnline = () => ping();
      const onOffline = () => setStatus('offline');
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        clearInterval(interval);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    return () => clearInterval(interval);
  }, [ping]);

  return { status, isOffline: status === 'offline', isSlow: status === 'slow', retry: ping };
}
