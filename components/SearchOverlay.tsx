/**
 * Full-screen search overlay — modal-based, renders above everything.
 *
 * Features:
 * - Animated slide-down + fade-in on open
 * - Blur / dim overlay behind
 * - Recent searches with clear-all
 * - Trending / popular searches
 * - Live suggestions grouped by type (Products, Categories, Brands/Gear)
 * - Skeleton loading rows while computing
 * - Highlighted matching text
 * - Empty state with illustration
 * - RTL-aware
 * - Light + Dark theme
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Tag,
  Package,
  ShoppingBag,
  ArrowUpLeft,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';
import { Radius, FontSize, Spacing } from '@/constants/theme';
import { useThemeColors, useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  useSearchSuggestions,
  addRecentSearch,
  clearAllRecent,
  type Suggestion,
  type SuggestionSource,
} from '@/hooks/useSearchSuggestions';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRENDING: string[] = [
  'Parachute',
  'Helmet',
  'AAD',
  'Reserve',
  'Altimeter',
];

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns an array of {text, highlight} segments for a match. */
function highlightSegments(
  text: string,
  query: string,
): Array<{ text: string; highlight: boolean }> {
  if (!query.trim()) return [{ text, highlight: false }];
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [{ text, highlight: false }];
  return [
    { text: text.slice(0, idx), highlight: false },
    { text: text.slice(idx, idx + query.length), highlight: true },
    { text: text.slice(idx + query.length), highlight: false },
  ];
}

function HighlightedText({
  text,
  query,
  style,
  highlightStyle,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: any;
  highlightStyle?: any;
  numberOfLines?: number;
}) {
  const segments = highlightSegments(text, query);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <Text key={i} style={highlightStyle}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ C }: { C: ReturnType<typeof useThemeColors> }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={[styles.skeletonCircle, { backgroundColor: C.backgroundInput }]} />
      <View style={styles.skeletonLines}>
        <View style={[styles.skeletonLine, { backgroundColor: C.backgroundInput, width: '65%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: C.backgroundInput, width: '35%', marginTop: 5 }]} />
      </View>
    </Animated.View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  onClear,
  C,
}: {
  label: string;
  onClear?: () => void;
  C: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: C.textMuted }]}>{label}</Text>
      {onClear && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.sectionClearBtn}
        >
          <Trash2 size={13} color={C.textMuted} strokeWidth={2} />
          <Text style={[styles.sectionClearText, { color: C.textMuted }]}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Type icons ───────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<Suggestion['type'], React.ComponentType<any>> = {
  product:  Package,
  category: Tag,
  brand:    Tag,
  gear:     ShoppingBag,
  recent:   Clock,
};

const TYPE_LABEL: Record<Suggestion['type'], string> = {
  product:  'Product',
  category: 'Category',
  brand:    'Brand',
  gear:     'Used Gear',
  recent:   'Recent',
};

// ─── Main overlay ─────────────────────────────────────────────────────────────

export type SearchOverlayProps = {
  visible: boolean;
  source: SuggestionSource;
  initialQuery?: string;
  placeholder?: string;
  onClose: () => void;
  onCommit: (query: string) => void;
};

export default function SearchOverlay({
  visible,
  source,
  initialQuery = '',
  placeholder,
  onClose,
  onCommit,
}: SearchOverlayProps) {
  const C = useThemeColors();
  const { preset } = useTheme();
  const isDark = preset !== 'light';
  const { t, isRTL } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t.searchGear ?? 'Search…';

  // ── State ──
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<TextInput>(null);

  // ── Animations ──
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(-32)).current;

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(panelAnim, {
          toValue: 0,
          tension: 100,
          friction: 14,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Autofocus after animation
        setTimeout(() => inputRef.current?.focus(), 50);
      });
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(panelAnim, {
          toValue: -16,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ── Search suggestions ──
  const {
    suggestions,
    recentSearches,
    loading: suggestionsLoading,
    refreshRecent,
  } = useSearchSuggestions(query, source, visible);

  const handleClearRecent = useCallback(() => {
    clearAllRecent().then(() => refreshRecent());
  }, [refreshRecent]);

  const handleCommit = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      addRecentSearch(trimmed).then(() => refreshRecent());
      onCommit(trimmed);
      onClose();
    },
    [onCommit, onClose, refreshRecent],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  // ── Group suggestions ──
  const grouped = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    for (const s of suggestions) {
      const key =
        s.type === 'recent'
          ? 'Recent'
          : s.type === 'category'
          ? 'Categories'
          : s.type === 'brand'
          ? 'Brands & Models'
          : s.type === 'gear'
          ? 'Used Gear'
          : 'Products';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [suggestions]);

  const isTyping = query.trim().length > 0;
  const showRecents = !isTyping && recentSearches.length > 0;
  const showTrending = !isTyping && recentSearches.length === 0;
  const showResults = isTyping;
  const showEmpty = isTyping && !suggestionsLoading && suggestions.length === 0;

  const panelBg = isDark ? C.backgroundSecondary : C.backgroundSecondary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark
                ? 'rgba(0,0,0,0.72)'
                : 'rgba(15,32,64,0.45)',
              opacity: backdropAnim,
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: panelBg,
            borderBottomColor: C.border,
            transform: [{ translateY: panelAnim }],
            opacity: backdropAnim,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* ── Search input row ── */}
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: C.backgroundCard,
              borderColor: C.neonBlue,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            },
          ]}
        >
          <Search
            size={18}
            color={C.neonBlue}
            strokeWidth={2.5}
            style={isRTL ? styles.iconRTL : styles.iconLTR}
          />
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              {
                color: C.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder={resolvedPlaceholder}
            placeholderTextColor={C.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
            onSubmitEditing={() => handleCommit(query)}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.clearBtn, { backgroundColor: C.backgroundInput }]}
            >
              <X size={13} color={C.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { color: C.neonBlue }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* ── Results area ── */}
        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.resultsContent}
        >
          {/* ── Skeleton loading ── */}
          {suggestionsLoading && (
            <View style={styles.skeletonWrap}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} C={C} />
              ))}
            </View>
          )}

          {/* ── Recent searches ── */}
          {showRecents && !suggestionsLoading && (
            <View>
              <SectionHeader
                label="RECENT SEARCHES"
                onClear={handleClearRecent}
                C={C}
              />
              {recentSearches.slice(0, 6).map((term, i) => (
                <TouchableOpacity
                  key={`r-${i}`}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: C.border,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                  onPress={() => handleCommit(term)}
                  activeOpacity={0.65}
                >
                  <View style={[styles.rowIcon, { backgroundColor: C.backgroundInput }]}>
                    <Clock size={14} color={C.textMuted} strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      styles.rowLabel,
                      { color: C.textSecondary, textAlign: isRTL ? 'right' : 'left' },
                    ]}
                    numberOfLines={1}
                  >
                    {term}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setQuery(term)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ArrowUpLeft
                      size={16}
                      color={C.textMuted}
                      strokeWidth={2}
                      style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Trending searches ── */}
          {showTrending && !suggestionsLoading && (
            <View>
              <SectionHeader label="TRENDING SEARCHES" C={C} />
              <View style={styles.trendingWrap}>
                {TRENDING.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.trendingChip,
                      { backgroundColor: C.backgroundCard, borderColor: C.border },
                    ]}
                    onPress={() => handleCommit(term)}
                    activeOpacity={0.7}
                  >
                    <TrendingUp size={11} color={C.neonBlue} strokeWidth={2.5} />
                    <Text style={[styles.trendingLabel, { color: C.textSecondary }]}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Live suggestions grouped ── */}
          {showResults && !suggestionsLoading && suggestions.length > 0 && (
            <View>
              {Object.entries(grouped).map(([groupName, items]) => (
                <View key={groupName}>
                  <SectionHeader label={groupName.toUpperCase()} C={C} />
                  {items.map((s, i) => {
                    const Icon = TYPE_ICONS[s.type];
                    return (
                      <TouchableOpacity
                        key={`${groupName}-${i}`}
                        style={[
                          styles.row,
                          {
                            borderBottomColor: C.border,
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                          },
                          i === items.length - 1 && styles.rowLast,
                        ]}
                        onPress={() => handleCommit(s.label)}
                        activeOpacity={0.65}
                      >
                        <View
                          style={[
                            styles.rowIcon,
                            { backgroundColor: C.neonBlueGlow },
                          ]}
                        >
                          <Icon size={14} color={C.neonBlue} strokeWidth={2} />
                        </View>
                        <View
                          style={[
                            styles.rowBody,
                            { alignItems: isRTL ? 'flex-end' : 'flex-start' },
                          ]}
                        >
                          <HighlightedText
                            text={s.label}
                            query={query}
                            style={[styles.rowLabel, { color: C.textPrimary }]}
                            highlightStyle={[
                              styles.rowLabelHighlight,
                              { color: C.neonBlue },
                            ]}
                            numberOfLines={1}
                          />
                          {s.sublabel ? (
                            <Text
                              style={[
                                styles.rowSub,
                                {
                                  color: C.textMuted,
                                  textAlign: isRTL ? 'right' : 'left',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {s.sublabel}
                            </Text>
                          ) : null}
                        </View>
                        <ChevronRight
                          size={14}
                          color={C.textMuted}
                          strokeWidth={2}
                          style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* ── Empty state ── */}
          {showEmpty && (
            <View style={styles.emptyWrap}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: C.backgroundCard, borderColor: C.border },
                ]}
              >
                <Search size={32} color={C.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>
                No results for "{query}"
              </Text>
              <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>
                Try a different keyword, check your spelling, or browse trending searches.
              </Text>
              <View style={styles.emptyTrending}>
                {TRENDING.slice(0, 3).map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={[
                      styles.trendingChip,
                      { backgroundColor: C.backgroundCard, borderColor: C.neonBlueBorder },
                    ]}
                    onPress={() => handleCommit(term)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.trendingLabel, { color: C.neonBlue }]}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Spacer so last item is never cut off by safe area */}
          <View style={{ height: 48 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PANEL_TOP = Platform.OS === 'web' ? 0 : 0;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    top: PANEL_TOP,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 32 : 12,
    paddingBottom: 0,
    // Web shadow
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.45)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 20,
        }),
  },

  // Input row
  inputRow: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: Platform.OS === 'web' ? 46 : 50,
    alignItems: 'center',
    gap: 8,
  },
  iconLTR: { marginRight: 2 },
  iconRTL: { marginLeft: 2 },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
    padding: 0,
    margin: 0,
    height: '100%',
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  cancelBtn: {
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // Results scroll area
  results: {
    flex: 1,
  },
  resultsContent: {
    paddingTop: 4,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  sectionClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionClearText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },

  // List row
  row: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  rowLabelHighlight: {
    fontWeight: '800',
  },
  rowSub: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Trending chips
  trendingWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  trendingLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },

  // Skeleton
  skeletonWrap: {
    paddingTop: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  skeletonCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    flexShrink: 0,
  },
  skeletonLines: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyTrending: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
});
