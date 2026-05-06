import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Radius, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.md * 2 - Spacing.sm) / 2;

export default function LoadingSkeleton() {
  const Colors = useThemeColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((k) => (
        <Animated.View key={k} style={[{
          width: CARD_WIDTH,
          backgroundColor: Colors.backgroundCard,
          borderRadius: Radius.lg,
          overflow: 'hidden',
          padding: Spacing.sm,
        }, { opacity }]}>
          <View style={{ width: '100%', height: CARD_WIDTH * 0.85, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md, marginBottom: Spacing.sm }} />
          <View style={{ height: 12, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, marginBottom: 6, width: '80%' }} />
          <View style={{ height: 12, backgroundColor: Colors.navyLight, borderRadius: Radius.sm, marginBottom: 6, width: '60%' }} />
          <View style={{ height: 12, backgroundColor: Colors.neonBlueDim, borderRadius: Radius.sm, marginBottom: 6, width: '40%', opacity: 0.4 }} />
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
