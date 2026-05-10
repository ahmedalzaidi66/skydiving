import React, { useRef, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Platform, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useThemeColors } from '@/context/ThemeContext';
import { Product } from '@/lib/supabase';

type Props = {
  product: Product;
  size?: number;
  onLoginRequired?: () => void;
  onToggle?: (added: boolean) => void;
  variant?: 'card' | 'detail';
};

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function useParticleBurst(count: number) {
  return Array.from({ length: count }, () => ({
    translate: useRef(new Animated.ValueXY({ x: 0, y: 0 })).current,
    opacity: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(0)).current,
  }));
}

export default function WishlistHeart({ product, size = 18, onLoginRequired, onToggle, variant = 'card' }: Props) {
  const Colors = useThemeColors();
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const { showWishlistToast } = useWishlistToast();
  const { t } = useLanguage();
  const saved = isWishlisted(product.id);

  const scale = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0.6)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const particles = useParticleBurst(PARTICLE_ANGLES.length);

  const burstParticles = useCallback((radius: number) => {
    const animations = particles.map((p, i) => {
      const angleRad = (PARTICLE_ANGLES[i] * Math.PI) / 180;
      p.translate.setValue({ x: 0, y: 0 });
      p.opacity.setValue(1);
      p.scale.setValue(0.4);
      return Animated.parallel([
        Animated.timing(p.translate, { toValue: { x: Math.cos(angleRad) * radius, y: Math.sin(angleRad) * radius }, duration: 420, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(p.opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(animations).start();
  }, [particles]);

  const playAddAnimation = useCallback(() => {
    rippleScale.setValue(0.6);
    rippleOpacity.setValue(0.7);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 0.75, useNativeDriver: true, speed: 80, bounciness: 0 }),
        Animated.spring(scale, { toValue: 1.5, useNativeDriver: true, speed: 40, bounciness: 0 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }),
      ]),
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 2.2, duration: 480, useNativeDriver: true }),
        Animated.timing(rippleOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();
    burstParticles(variant === 'detail' ? 22 : 16);
  }, [scale, rippleScale, rippleOpacity, burstParticles, variant]);

  const playRemoveAnimation = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, speed: 60, bounciness: 0 }),
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
    ]).start();
  }, [scale]);

  const handlePress = useCallback(async () => {
    if (!isAuthenticated) { onLoginRequired?.(); return; }
    const { added } = await toggle(product);
    added ? playAddAnimation() : playRemoveAnimation();
    showWishlistToast(added, added ? (t.addedToWishlist ?? 'Added to favorites') : (t.removedFromWishlist ?? 'Removed from favorites'));
    onToggle?.(added);
  }, [isAuthenticated, product, toggle, onLoginRequired, onToggle, playAddAnimation, playRemoveAnimation, showWishlistToast, t]);

  const iconColor = saved ? '#FF4D6D' : Colors.textSecondary;
  const fillColor = saved ? '#FF4D6D' : 'transparent';
  const particleSize = Math.max(4, Math.round(size * 0.32));
  const heartNode = <Heart size={size} color={iconColor} fill={fillColor} strokeWidth={2} />;

  if (variant === 'detail') {
    return (
      <TouchableOpacity
        style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: saved ? 'rgba(255,77,109,0.15)' : Colors.neonBlueGlow, borderWidth: 1, borderColor: saved ? 'rgba(255,77,109,0.35)' : Colors.border, justifyContent: 'center', alignItems: 'center', overflow: 'visible' }]}
        onPress={handlePress}
        activeOpacity={0.75}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Animated.View style={[styles.ripple, { width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4, transform: [{ scale: rippleScale }], opacity: rippleOpacity }]} pointerEvents="none" />
        {particles.map((p, i) => (
          <Animated.View key={i} style={[styles.particle, { width: particleSize, height: particleSize, borderRadius: particleSize / 2, transform: [{ translateX: p.translate.x }, { translateY: p.translate.y }, { scale: p.scale }], opacity: p.opacity }]} pointerEvents="none" />
        ))}
        <Animated.View style={{ transform: [{ scale }] }}>{heartNode}</Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.cardBtn} onPress={handlePress} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <Animated.View style={[styles.ripple, { width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4, transform: [{ scale: rippleScale }], opacity: rippleOpacity }]} pointerEvents="none" />
      {particles.map((p, i) => (
        <Animated.View key={i} style={[styles.particle, { width: particleSize, height: particleSize, borderRadius: particleSize / 2, transform: [{ translateX: p.translate.x }, { translateY: p.translate.y }, { scale: p.scale }], opacity: p.opacity }]} pointerEvents="none" />
      ))}
      <Animated.View style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {}) }, { transform: [{ scale }] }]}>
        {heartNode}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FF4D6D',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#FF4D6D',
  },
});
