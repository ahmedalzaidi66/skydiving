import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useCMS } from '@/context/CMSContext';

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  backgroundCard: string;
  backgroundInput: string;
  navy: string;
  navyLight: string;
  neonBlue: string;
  neonBlueDim: string;
  neonBlueGlow: string;
  neonBlueBorder: string;
  white: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  successDim: string;
  warning: string;
  error: string;
  errorDim: string;
  gold: string;
  goldDim: string;
  border: string;
  borderLight: string;
  overlay: string;
  tabBar: string;
};

const DARK: ThemeColors = {
  background: '#050A14',
  backgroundSecondary: '#0A1628',
  backgroundCard: '#0D1E35',
  backgroundInput: '#0A1628',
  navy: '#0F2040',
  navyLight: '#162A50',
  neonBlue: '#00BFFF',
  neonBlueDim: '#007ACC',
  neonBlueGlow: 'rgba(0,191,255,0.15)',
  neonBlueBorder: 'rgba(0,191,255,0.3)',
  white: '#FFFFFF',
  textPrimary: '#E8F4FD',
  textSecondary: '#7EB5D6',
  textMuted: '#4A7A99',
  success: '#00E676',
  successDim: 'rgba(0,230,118,0.15)',
  warning: '#FFB300',
  error: '#FF4444',
  errorDim: 'rgba(255,68,68,0.15)',
  gold: '#FFD700',
  goldDim: '#CC9900',
  border: 'rgba(0,191,255,0.15)',
  borderLight: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(5,10,20,0.85)',
  tabBar: 'rgba(5,10,20,0.97)',
};

const LIGHT: ThemeColors = {
  background: '#F0F4F8',
  backgroundSecondary: '#FFFFFF',
  backgroundCard: '#FFFFFF',
  backgroundInput: '#F8FAFB',
  navy: '#E2EBF5',
  navyLight: '#D0DEEC',
  neonBlue: '#0077B6',
  neonBlueDim: '#005F8F',
  neonBlueGlow: 'rgba(0,119,182,0.12)',
  neonBlueBorder: 'rgba(0,119,182,0.25)',
  white: '#FFFFFF',
  textPrimary: '#0D1B2A',
  textSecondary: '#2E5F85',
  textMuted: '#6B8FAD',
  success: '#00875A',
  successDim: 'rgba(0,135,90,0.12)',
  warning: '#E07B00',
  error: '#D63031',
  errorDim: 'rgba(214,48,49,0.1)',
  gold: '#B8860B',
  goldDim: '#8B6508',
  border: 'rgba(0,119,182,0.18)',
  borderLight: 'rgba(0,0,0,0.06)',
  overlay: 'rgba(240,244,248,0.88)',
  tabBar: 'rgba(240,244,248,0.97)',
};

export const THEME_PRESETS: Record<string, ThemeColors> = {
  dark: DARK,
  light: LIGHT,
  // legacy name stored in DB
  'midnight-blue': DARK,
};

const STORAGE_KEY = 'app_theme_preset';

function readCachedPreset(): string | null {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function writeCachedPreset(preset: string): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, preset);
    } catch {}
  } else {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem(STORAGE_KEY, preset).catch(() => {});
    });
  }
}

type ThemeContextType = {
  colors: ThemeColors;
  preset: string;
};

const ThemeContext = createContext<ThemeContextType>({ colors: DARK, preset: 'dark' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useCMS();

  // Initialise synchronously from localStorage on web so there is no flash-of-wrong-theme.
  const [preset, setPreset] = useState<string>(() => {
    const cached = readCachedPreset();
    if (cached && THEME_PRESETS[cached]) return cached;
    return 'dark';
  });

  // On native AsyncStorage is async — apply cached value after first render.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.getItem(STORAGE_KEY).then((cached) => {
          if (cached && THEME_PRESETS[cached]) setPreset(cached);
        }).catch(() => {});
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the DB value arrives or changes, adopt it and persist locally so the
  // next cold-start uses the correct preset without waiting for the network.
  useEffect(() => {
    if (!theme?.active_preset) return;
    const normalized = theme.active_preset === 'midnight-blue' ? 'dark' : theme.active_preset;
    if (!THEME_PRESETS[normalized]) return;
    setPreset(normalized);
    writeCachedPreset(normalized);
  }, [theme?.active_preset]);

  const colors = useMemo(() => THEME_PRESETS[preset] ?? DARK, [preset]);

  return (
    <ThemeContext.Provider value={{ colors, preset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Drop-in replacement for Colors from constants/theme — theme-aware */
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}
