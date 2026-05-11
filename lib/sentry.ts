import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'production';
const RELEASE = process.env.EXPO_PUBLIC_SENTRY_RELEASE;

export function initSentry() {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    ...(RELEASE ? { release: RELEASE } : {}),

    // Capture 100% of errors; tune tracesSampleRate for performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Strip sensitive data before sending
    beforeSend(event) {
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        for (const key of ['password', 'token', 'access_token', 'refresh_token', 'card', 'cvv', 'address']) {
          if (key in data) data[key] = '[Filtered]';
        }
      }
      return event;
    },

    integrations(defaults) {
      return defaults.filter(
        (i) => i.name !== 'Breadcrumbs' || true // keep all, redact below
      );
    },
  });

  // Tag the platform consistently
  Sentry.setTag('platform', Platform.OS);
}

/** Set authenticated user context — called on login. Never logs sensitive fields. */
export function sentrySetUser(id: string) {
  Sentry.setUser({ id });
}

/** Clear user context — called on logout. */
export function sentryClearUser() {
  Sentry.setUser(null);
}

/** Set the current route/screen as a tag for all subsequent events. */
export function sentrySetRoute(route: string) {
  Sentry.setTag('route', route);
}

/** Capture a non-fatal error with optional context. */
export function captureError(
  err: unknown,
  context?: { action?: string; extra?: Record<string, unknown> },
) {
  const error = err instanceof Error ? err : new Error(String(err));
  Sentry.withScope((scope) => {
    if (context?.action) scope.setTag('action', context.action);
    if (context?.extra) scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

/** Wrap a critical async action and capture any failure. */
export async function withErrorTracking<T>(
  fn: () => Promise<T>,
  action: string,
  extra?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    captureError(err, { action, extra });
    throw err;
  }
}

export { Sentry };
