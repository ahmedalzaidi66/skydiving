import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FontSize, Spacing } from '@/constants/theme';

export default function NetworkBanner() {
  const { status } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-48)).current;
  const prevStatus = useRef(status);

  useEffect(() => {
    const show = status !== 'online';
    Animated.timing(slideAnim, {
      toValue: show ? 0 : -48,
      duration: 280,
      useNativeDriver: true,
    }).start();
    prevStatus.current = status;
  }, [status]);

  if (status === 'online') return null;

  const isOffline = status === 'offline';

  return (
    <Animated.View
      style={[
        styles.banner,
        isOffline ? styles.offlineBg : styles.slowBg,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      {isOffline
        ? <WifiOff size={14} color="#fff" strokeWidth={2.5} />
        : <Wifi size={14} color="#fff" strokeWidth={2.5} />
      }
      <Text style={styles.text}>
        {isOffline ? 'No internet connection' : 'Slow connection — some content may take longer to load'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any, top: 0, left: 0, right: 0 } : {}),
  },
  offlineBg: { backgroundColor: '#DC2626' },
  slowBg: { backgroundColor: '#B45309' },
  text: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
