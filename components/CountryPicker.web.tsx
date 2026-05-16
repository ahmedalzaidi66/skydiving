/**
 * Web-only CountryPicker.
 * The dropdown panel is rendered via react-dom createPortal into a real <div>
 * appended to document.body with direct inline CSS — this guarantees correct
 * background colours in dark/light mode regardless of React Native Web's
 * class-based style engine or the browser's user-agent stylesheet.
 */
import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, I18nManager,
} from 'react-native';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { Spacing, FontSize, Radius } from '@/constants/theme';
import {
  COUNTRIES, getCountryByCode, getCountryDisplayName, countryFlag,
  type Country,
} from './CountryPicker';

// ─── Props (identical to native) ─────────────────────────────────────────────

type Props = {
  value: string;
  onChange: (code: string, displayName: string) => void;
  language?: string;
  label?: string;
  error?: string;
  style?: object;
  placeholder?: string;
};

// ─── Web portal dropdown ──────────────────────────────────────────────────────

function WebDropdown({
  anchorRef,
  onClose,
  value,
  onChange,
  language,
  Colors,
  isRTL,
}: {
  anchorRef: React.RefObject<View | null>;
  onClose: () => void;
  value: string;
  onChange: (code: string, name: string) => void;
  language: string;
  Colors: any;
  isRTL: boolean;
}) {
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Measure the trigger's screen position to anchor the panel below it
  useEffect(() => {
    if (!anchorRef.current) return;
    // React Native Web exposes the underlying DOM node via the ref
    const domNode = (anchorRef.current as any)._nativeTag
      ? document.querySelector(`[data-reactroot]`)
      : (anchorRef.current as any);

    // Use getBoundingClientRect via the ref's internal DOM node
    const node = (anchorRef.current as any);
    if (node && typeof node.measure === 'function') {
      node.measure((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
        const panelW = Math.max(w, 320);
        const spaceBelow = window.innerHeight - py - h;
        const openAbove = spaceBelow < 320 && py > 320;
        setRect({
          top: openAbove ? py - 4 : py + h + 4,
          left: isRTL ? px + w - panelW : px,
          width: panelW,
        });
      });
    } else {
      // Fallback: centre on screen
      setRect({ top: 120, left: Math.max(8, (window.innerWidth - 360) / 2), width: 360 });
    }
    setTimeout(() => searchRef.current?.focus(), 60);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.en.toLowerCase().includes(q) ||
        c.ar.includes(query.trim()) ||
        c.code.toLowerCase() === q,
    );
  }, [query]);

  const handleSelect = (country: Country) => {
    onChange(country.code, country.en);
    onClose();
  };

  if (!rect) return null;

  // All styles are plain CSS strings applied directly to real DOM elements.
  // This bypasses React Native Web entirely and guarantees correct rendering.
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
    width: rect.width,
    maxWidth: 420,
    zIndex: 99999,
    backgroundColor: Colors.backgroundCard,
    border: `1px solid ${Colors.border}`,
    borderRadius: 14,
    boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 99998,
    backgroundColor: 'rgba(0,0,0,0.25)',
  };

  const searchRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    backgroundColor: Colors.backgroundSecondary,
    borderBottom: `1px solid ${Colors.border}`,
    flexShrink: 0,
  };

  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    background: Colors.backgroundSecondary,
    color: Colors.textPrimary,
    border: 'none',
    outline: 'none',
    fontSize: 14,
    padding: 0,
    fontFamily: 'inherit',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  const listStyle: React.CSSProperties = {
    overflowY: 'auto',
    maxHeight: 280,
    backgroundColor: Colors.backgroundCard,
  };

  const emptyStyle: React.CSSProperties = {
    padding: '24px 16px',
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    backgroundColor: Colors.backgroundCard,
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onMouseDown={(e) => { e.preventDefault(); onClose(); }} />

      {/* Panel */}
      <div ref={panelRef} style={panelStyle}>
        {/* Search */}
        <div style={searchRowStyle}>
          <Search size={14} color={Colors.textMuted} strokeWidth={2} />
          <input
            ref={searchRef}
            style={searchInputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث...' : 'Search...'}
          />
          {query.length > 0 && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
              onMouseDown={(e) => { e.preventDefault(); setQuery(''); }}
            >
              <X size={13} color={Colors.textMuted} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Country list */}
        <div style={listStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No results'}
            </div>
          ) : (
            filtered.map((country) => {
              const isSelected = country.code === value;
              const name = getCountryDisplayName(country, language);
              const rowStyle: React.CSSProperties = {
                display: 'flex',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                backgroundColor: isSelected ? Colors.neonBlueGlow : Colors.backgroundCard,
                borderBottom: `1px solid ${Colors.borderLight}`,
                transition: 'background-color 0.12s',
              };
              return (
                <div
                  key={country.code}
                  style={rowStyle}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      isSelected ? Colors.neonBlueGlow : Colors.backgroundSecondary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      isSelected ? Colors.neonBlueGlow : Colors.backgroundCard;
                  }}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(country); }}
                >
                  <span style={{ fontSize: 17, lineHeight: '22px', width: 26, textAlign: 'center', flexShrink: 0 }}>
                    {countryFlag(country.code)}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: 14,
                    color: isSelected ? Colors.neonBlue : Colors.textPrimary,
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: isRTL ? 'right' : 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                  {isSelected && (
                    <span style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: Colors.neonBlue, flexShrink: 0,
                      display: 'inline-block',
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── Main component (web) ─────────────────────────────────────────────────────

export default function CountryPicker({
  value, onChange, language = 'en', label, error, style, placeholder,
}: Props) {
  const Colors = useThemeColors();
  const isRTL = I18nManager.isRTL;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);

  const selected = useMemo(() => getCountryByCode(value), [value]);
  const displayName = selected ? getCountryDisplayName(selected, language) : '';

  const triggerBorderColor = error ? Colors.error : open ? Colors.neonBlue : Colors.border;
  const triggerBg = error ? Colors.errorDim : Colors.backgroundInput;

  const handleClose = useCallback(() => setOpen(false), []);
  const handleChange = useCallback((code: string, name: string) => {
    onChange(code, name);
    setOpen(false);
  }, [onChange]);

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: Colors.textMuted }]}>{label}</Text>
      )}

      {/* Trigger */}
      <TouchableOpacity
        ref={triggerRef as any}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
        style={[
          styles.trigger,
          {
            backgroundColor: triggerBg,
            borderColor: triggerBorderColor,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
          style,
        ]}
      >
        {selected ? (
          <Text style={styles.flagEmoji}>{countryFlag(selected.code)}</Text>
        ) : (
          <Text style={[styles.flagEmoji, { color: Colors.textMuted, fontSize: 14, lineHeight: 18 }]}>🌐</Text>
        )}
        <Text
          style={[
            styles.triggerText,
            { color: selected ? Colors.textPrimary : Colors.textMuted, flex: 1, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {selected ? displayName : (placeholder ?? (language === 'ar' ? 'اختر الدولة' : 'Select country'))}
        </Text>
        <ChevronDown
          size={14}
          color={Colors.textMuted}
          strokeWidth={2}
          style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, { color: Colors.error }]}>{error}</Text>
      )}

      {open && (
        <WebDropdown
          anchorRef={triggerRef}
          onClose={handleClose}
          value={value}
          onChange={handleChange}
          language={language}
          Colors={Colors}
          isRTL={isRTL}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  flagEmoji: {
    fontSize: 16,
    lineHeight: 20,
    width: 22,
    textAlign: 'center',
  },
  triggerText: {
    fontSize: FontSize.md,
    padding: 0,
  },
  errorText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
