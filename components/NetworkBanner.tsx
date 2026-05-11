import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const BANNER_HEIGHT = 36;

export default function NetworkBanner() {
  const { isOffline, retry } = useNetworkStatus();

  // Keep the banner mounted during the slide-out animation so it doesn't
  // disappear before the animation completes.
  const [mounted, setMounted] = useState(false);
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const animRunning = useRef(false);

  useEffect(() => {
    if (isOffline) {
      setMounted(true);
      // Slight delay before sliding in prevents false-positive flashes
      // during normal page loads where a request briefly fails.
      const t = setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }).start();
      }, 300);
      return () => clearTimeout(t);
    } else {
      if (!mounted) return;
      animRunning.current = true;
      Animated.timing(slideAnim, {
        toValue: -BANNER_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          animRunning.current = false;
        }
      });
    }
  }, [isOffline]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <WifiOff size={12} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
      <Text style={styles.text} numberOfLines={1}>
        No internet connection
      </Text>
      <TouchableOpacity onPress={retry} style={styles.retryBtn} activeOpacity={0.7}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(30, 30, 30, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? { position: 'fixed' as any, top: 0, left: 0, right: 0 }
      : {}),
  },
  text: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  retryText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
});
