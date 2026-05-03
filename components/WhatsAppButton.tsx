import React, { useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Linking, Platform } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import { WHATSAPP_PHONE, WHATSAPP_DEFAULT_MESSAGE } from '@/constants/contact';

export function openWhatsApp(message?: string) {
  const text = encodeURIComponent(message ?? WHATSAPP_DEFAULT_MESSAGE);
  Linking.openURL(`https://wa.me/${WHATSAPP_PHONE}?text=${text}`).catch(() => {});
}

const BUTTON_SIZE = 48;

export default function WhatsAppButton() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.84, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  const fixedStyle = Platform.select<object>({
    web: {
      position: 'fixed' as any,
      bottom: 90,
      ...(isRTL ? { left: 16 } : { right: 16 }),
      zIndex: 9999,
    },
    default: {
      position: 'absolute',
      bottom: 90,
      ...(isRTL ? { left: 16 } : { right: 16 }),
      zIndex: 9999,
    },
  });

  return (
    <Animated.View style={[fixedStyle, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={openWhatsApp}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.button}
        accessibilityLabel="Contact us on WhatsApp"
        accessibilityRole="button"
      >
        <MessageCircle size={22} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#25D366',
    opacity: 0.9,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
