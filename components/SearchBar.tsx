/**
 * SearchBar — a styled tap-to-open trigger bar.
 *
 * Tapping anywhere opens the SearchOverlay modal.
 * When a query is active it shows the current term + a clear button.
 * The original prop API (value / onChangeText / placeholder / autoFocus) is
 * preserved for backwards compat — new callers use onOpen/onClear/activeQuery.
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Search, X, SlidersHorizontal } from 'lucide-react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  // ── Original API (backwards-compat, used by legacy call-sites) ──
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;

  // ── New API ──
  /** Currently committed search query shown in the bar */
  activeQuery?: string;
  /** Called when the bar is tapped — parent opens the overlay */
  onOpen?: () => void;
  /** Called when the × inside the bar is pressed */
  onClear?: () => void;
  /** Optional right-side filter button */
  onFilterPress?: () => void;
  /** Show a subtle animation pulse when there are active results */
  hasResults?: boolean;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  activeQuery,
  onOpen,
  onClear,
  onFilterPress,
}: Props) {
  const C = useThemeColors();
  const { t, isRTL } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t.searchGear ?? 'Search…';

  // Prefer the new `activeQuery` prop; fall back to legacy `value`
  const displayQuery = activeQuery ?? value ?? '';
  const hasQuery = displayQuery.trim().length > 0;

  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }, [pressAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  }, [pressAnim]);

  const handlePress = useCallback(() => {
    if (onOpen) onOpen();
    // Legacy: if caller only uses old API, simulate focus by calling onChangeText('')
    else if (onChangeText) onChangeText(value ?? '');
  }, [onOpen, onChangeText, value]);

  const handleClear = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      if (onClear) onClear();
      else if (onChangeText) onChangeText('');
    },
    [onClear, onChangeText],
  );

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[
          styles.container,
          {
            backgroundColor: C.backgroundCard,
            borderColor: hasQuery ? C.neonBlue : C.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        {/* Search icon */}
        <Search
          size={16}
          color={hasQuery ? C.neonBlue : C.textMuted}
          strokeWidth={2.5}
          style={isRTL ? styles.iconRTL : styles.iconLTR}
        />

        {/* Query text or placeholder */}
        <Text
          style={[
            styles.queryText,
            {
              color: hasQuery ? C.textPrimary : C.textMuted,
              textAlign: isRTL ? 'right' : 'left',
              flex: 1,
            },
          ]}
          numberOfLines={1}
        >
          {hasQuery ? displayQuery : resolvedPlaceholder}
        </Text>

        {/* Right side: clear btn or filter btn */}
        {hasQuery ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[styles.clearBtn, { backgroundColor: C.backgroundInput }]}
          >
            <X size={11} color={C.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
        ) : onFilterPress ? (
          <TouchableOpacity
            onPress={onFilterPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SlidersHorizontal size={15} color={C.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
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
  queryText: {
    fontSize: FontSize.sm,
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
