import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { TriangleAlert as AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Sentry } from '@/lib/sentry';

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  eventId: string | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  handleRetry = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.fallbackTitle ?? 'Something went wrong';
    const isDev = process.env.NODE_ENV !== 'production';

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <AlertTriangle size={36} color="#FF4444" strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            An unexpected error occurred. Our team has been notified. Please try again or reload the app.
          </Text>
          {isDev && this.state.eventId && (
            <Text style={styles.eventId}>Event ID: {this.state.eventId}</Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.8}>
            <RefreshCw size={15} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.reloadBtn}
              onPress={() => (window as any).location?.reload?.()}
              activeOpacity={0.7}
            >
              <Text style={styles.reloadText}>Reload Page</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#050A14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0D1E35',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.25)',
    padding: 32,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#E8F4FD',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: '#7EB5D6',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  eventId: {
    color: '#4A7A99',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00BFFF',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reloadBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  reloadText: {
    color: '#4A7A99',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
