import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View, Platform } from 'react-native';
import { Heart, HeartOff, ShoppingCart } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { FontSize, Radius, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  added: boolean;
  message: string;
  variant?: 'wishlist' | 'cart';
};

export default function WishlistToast({ visible, added, message, variant = 'wishlist' }: Props) {
  const Colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 0 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 25, bounciness: 8 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 8 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.92, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const isCart = variant === 'cart';
  const accentColor = isCart ? Colors.neonBlue : (added ? '#FF4D6D' : Colors.textMuted);
  const iconBg = isCart ? Colors.neonBlueGlow : (added ? 'rgba(255,77,109,0.15)' : Colors.borderLight);

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: 'absolute',
        bottom: Platform.OS === 'web' ? 100 : 90,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.overlay,
        borderRadius: Radius.full,
        paddingVertical: 10,
        paddingHorizontal: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
      }, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        {isCart
          ? <ShoppingCart size={14} color={accentColor} strokeWidth={2} />
          : added
            ? <Heart size={14} color={accentColor} fill={accentColor} strokeWidth={2} />
            : <HeartOff size={14} color={accentColor} strokeWidth={2} />
        }
      </View>
      <Text style={{ color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' }}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
