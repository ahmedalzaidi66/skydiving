import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Radius, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.md * 2 - Spacing.sm) / 2;

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
}

// ── Product grid skeleton (2-column cards) ────────────────────────────────────
export default function LoadingSkeleton({ count = 4 }: { count?: number }) {
  const Colors = useThemeColors();
  const opacity = useShimmer();

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, k) => (
        <Animated.View
          key={k}
          style={[{
            width: CARD_WIDTH,
            backgroundColor: Colors.backgroundCard,
            borderRadius: Radius.lg,
            overflow: 'hidden',
            padding: Spacing.sm,
          }, { opacity }]}
        >
          <View style={{ width: '100%', height: CARD_WIDTH * 0.85, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, marginBottom: Spacing.sm }} />
          <View style={{ height: 12, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, marginBottom: 6, width: '80%' }} />
          <View style={{ height: 12, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, marginBottom: 6, width: '60%' }} />
          <View style={{ height: 12, backgroundColor: Colors.neonBlueDim, borderRadius: Radius.sm, marginBottom: 6, width: '40%', opacity: 0.4 }} />
        </Animated.View>
      ))}
    </View>
  );
}

// ── Gear listing card skeleton (full-width rows) ───────────────────────────────
export function GearListingSkeleton({ count = 5 }: { count?: number }) {
  const Colors = useThemeColors();
  const opacity = useShimmer();

  return (
    <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
      {Array.from({ length: count }).map((_, k) => (
        <Animated.View
          key={k}
          style={[{
            flexDirection: 'row',
            backgroundColor: Colors.backgroundCard,
            borderRadius: Radius.lg,
            overflow: 'hidden',
            padding: Spacing.sm,
            gap: Spacing.sm,
          }, { opacity }]}
        >
          <View style={{ width: 90, height: 90, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, flexShrink: 0 }} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <View style={{ height: 13, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, width: '75%' }} />
            <View style={{ height: 11, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, width: '50%' }} />
            <View style={{ height: 11, backgroundColor: Colors.neonBlueDim, borderRadius: Radius.sm, width: '35%', opacity: 0.5 }} />
            <View style={{ height: 11, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, width: '60%', opacity: 0.4 }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Generic list row skeleton ─────────────────────────────────────────────────
export function ListRowSkeleton({ count = 6 }: { count?: number }) {
  const Colors = useThemeColors();
  const opacity = useShimmer();

  return (
    <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
      {Array.from({ length: count }).map((_, k) => (
        <Animated.View
          key={k}
          style={[{
            backgroundColor: Colors.backgroundCard,
            borderRadius: Radius.lg,
            padding: Spacing.md,
            gap: 8,
          }, { opacity }]}
        >
          <View style={{ height: 13, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, width: '70%' }} />
          <View style={{ height: 11, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, width: '45%' }} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
