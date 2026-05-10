import React, { useRef, useState, useCallback } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function SearchBar({ value, onChangeText, placeholder, autoFocus }: Props) {
  const C = useThemeColors();
  const { t, isRTL } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t.searchGear;
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [borderAnim]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  }, [borderAnim]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.neonBlue],
  });

  const iconColor = focused || value.length > 0 ? C.neonBlue : C.textMuted;

  return (
    <Animated.View style={[styles.container, { borderColor, backgroundColor: C.backgroundCard }]}>
      <Search size={16} color={iconColor} strokeWidth={2} style={isRTL ? styles.iconRTL : styles.iconLTR} />
      <TextInput
        style={[styles.input, { color: C.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={C.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.clearBtn, { backgroundColor: C.backgroundInput }]}
        >
          <X size={12} color={C.textMuted} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    height: Platform.OS === 'web' ? 40 : 44,
    gap: Spacing.sm,
  },
  iconLTR: {},
  iconRTL: {},
  input: {
    flex: 1,
    fontSize: FontSize.sm,
    padding: 0,
    margin: 0,
    fontWeight: '500',
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
