import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Platform, useColorScheme } from 'react-native';
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

export type UserThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'app_theme_preset';

function readCachedChoice(): string | null {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function writeCachedChoice(choice: string): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, choice);
    } catch {}
  } else {
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.setItem(STORAGE_KEY, choice).catch(() => {});
    });
  }
}

// Resolve 'system' to an actual preset using a device scheme hint.
function resolvePreset(choice: string, systemScheme: 'light' | 'dark'): string {
  if (choice === 'system') return systemScheme;
  if (THEME_PRESETS[choice]) return choice;
  return 'dark';
}

// Read the system color scheme synchronously on web.
function readSystemScheme(): 'light' | 'dark' {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {}
  }
  return 'dark';
}

type ThemeContextType = {
  colors: ThemeColors;
  /** Resolved preset: always 'light' or 'dark' — never 'system'. Use for color lookups. */
  preset: string;
  /** What the user actually chose: 'light', 'dark', or 'system'. */
  userChoice: UserThemeChoice;
  setThemePreset: (preset: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colors: DARK,
  preset: 'dark',
  userChoice: 'dark',
  setThemePreset: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useCMS();
  const deviceScheme = useColorScheme() ?? 'dark';

  // Stored choice: 'light' | 'dark' | 'system' — persisted to storage.
  const [userChoice, setUserChoice] = useState<UserThemeChoice>(() => {
    const cached = readCachedChoice();
    if (cached === 'light' || cached === 'dark' || cached === 'system') return cached;
    // Legacy: stored value was 'midnight-blue' or other DB preset name
    if (cached && THEME_PRESETS[cached]) return cached === 'light' ? 'light' : 'dark';
    return 'dark';
  });

  // On native AsyncStorage is async — apply cached value after first render.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.getItem(STORAGE_KEY).then((cached) => {
          if (cached === 'light' || cached === 'dark' || cached === 'system') {
            setUserChoice(cached);
          } else if (cached && THEME_PRESETS[cached]) {
            setUserChoice(cached === 'light' ? 'light' : 'dark');
          }
        }).catch(() => {});
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the DB value arrives, only apply it if the user has no locally saved preference.
  useEffect(() => {
    if (!theme?.active_preset) return;
    const normalized = theme.active_preset === 'midnight-blue' ? 'dark' : theme.active_preset;
    if (!THEME_PRESETS[normalized]) return;
    const cached = readCachedChoice();
    if (cached) return; // user has a saved preference — never override it
    const choice = normalized === 'light' ? 'light' : 'dark';
    setUserChoice(choice as UserThemeChoice);
    writeCachedChoice(choice);
  }, [theme?.active_preset]);

  const setThemePreset = useCallback((newPreset: string) => {
    const normalized = newPreset === 'midnight-blue' ? 'dark' : newPreset;
    if (normalized !== 'light' && normalized !== 'dark' && normalized !== 'system') return;
    setUserChoice(normalized as UserThemeChoice);
    writeCachedChoice(normalized);
  }, []);

  // Resolve the actual preset to use for colors.
  const preset = useMemo(
    () => resolvePreset(userChoice, deviceScheme as 'light' | 'dark'),
    [userChoice, deviceScheme],
  );

  const colors = useMemo(() => THEME_PRESETS[preset] ?? DARK, [preset]);

  return (
    <ThemeContext.Provider value={{ colors, preset, userChoice, setThemePreset }}>
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
