import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Search, X, Clock, Tag, Package, ShoppingBag, Trash2 } from 'lucide-react-native';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import type { Suggestion } from '@/hooks/useSearchSuggestions';

type Props = {
  // Original API — unchanged
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;

  // New optional props
  suggestions?: Suggestion[];
  recentSearches?: string[];
  suggestionsLoading?: boolean;
  onSuggestionSelect?: (label: string) => void;
  onClearRecent?: () => void;
  showDropdown?: boolean;
};

const SUGGESTION_ICONS: Record<Suggestion['type'], React.ComponentType<any>> = {
  product:  Package,
  category: Tag,
  brand:    Tag,
  gear:     ShoppingBag,
  recent:   Clock,
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  suggestions = [],
  recentSearches = [],
  suggestionsLoading = false,
  onSuggestionSelect,
  onClearRecent,
  showDropdown = false,
}: Props) {
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

  // What to show in the dropdown
  const isTyping = value.trim().length > 0;
  const showRecents = !isTyping && recentSearches.length > 0 && showDropdown && focused;
  const showSuggestions = isTyping && showDropdown && (suggestions.length > 0 || suggestionsLoading);
  const dropdownVisible = showRecents || showSuggestions;

  const typeLabel: Record<Suggestion['type'], string> = {
    product:  'Product',
    category: 'Category',
    brand:    'Brand / Model',
    gear:     'Used Gear',
    recent:   'Recent',
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[
        styles.container,
        { borderColor, backgroundColor: C.backgroundCard },
        dropdownVisible && styles.containerOpen,
      ]}>
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
        {suggestionsLoading && isTyping && (
          <ActivityIndicator size="small" color={C.neonBlue} style={styles.loadingIndicator} />
        )}
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

      {/* ── Suggestions / Recent Dropdown ── */}
      {dropdownVisible && (
        <View style={[styles.dropdown, {
          backgroundColor: C.backgroundCard,
          borderColor: C.neonBlue,
          // Web: use box shadow; native: elevation
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' } as any
            : { elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }),
        }]}>
          {/* Recent searches header */}
          {showRecents && (
            <>
              <View style={styles.dropdownHeader}>
                <Text style={[styles.dropdownHeaderText, { color: C.textMuted }]}>
                  Recent Searches
                </Text>
                {onClearRecent && (
                  <TouchableOpacity onPress={onClearRecent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={13} color={C.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
              {recentSearches.slice(0, 6).map((term, i) => (
                <TouchableOpacity
                  key={`recent-${i}`}
                  style={[styles.dropdownItem, { borderBottomColor: C.border }]}
                  onPress={() => onSuggestionSelect?.(term)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: C.backgroundInput }]}>
                    <Clock size={12} color={C.textMuted} strokeWidth={2} />
                  </View>
                  <Text style={[styles.dropdownItemLabel, { color: C.textSecondary }]} numberOfLines={1}>
                    {term}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Suggestions while typing */}
          {showSuggestions && (
            <>
              {suggestionsLoading && suggestions.length === 0 && (
                <View style={styles.dropdownLoading}>
                  <ActivityIndicator size="small" color={C.neonBlue} />
                  <Text style={[styles.dropdownLoadingText, { color: C.textMuted }]}>Searching…</Text>
                </View>
              )}
              {suggestions.map((s, i) => {
                const Icon = SUGGESTION_ICONS[s.type];
                return (
                  <TouchableOpacity
                    key={`sug-${i}`}
                    style={[
                      styles.dropdownItem,
                      { borderBottomColor: C.border },
                      i === suggestions.length - 1 && styles.dropdownItemLast,
                    ]}
                    onPress={() => onSuggestionSelect?.(s.label)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: C.backgroundInput }]}>
                      <Icon size={12} color={C.neonBlue} strokeWidth={2} />
                    </View>
                    <View style={styles.dropdownItemBody}>
                      <Text style={[styles.dropdownItemLabel, { color: C.textPrimary }]} numberOfLines={1}>
                        {s.label}
                      </Text>
                      {s.sublabel && (
                        <Text style={[styles.dropdownItemSub, { color: C.textMuted }]} numberOfLines={1}>
                          {s.sublabel}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.dropdownItemType, { color: C.textMuted }]}>
                      {typeLabel[s.type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    height: Platform.OS === 'web' ? 40 : 44,
    gap: Spacing.sm,
  },
  containerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
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
  loadingIndicator: {
    marginLeft: 2,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 40 : 44,
    left: 0,
    right: 0,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    overflow: 'hidden',
    maxHeight: 320,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dropdownItemBody: {
    flex: 1,
    gap: 1,
  },
  dropdownItemLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  dropdownItemSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  dropdownItemType: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownLoadingText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
