import { useColorScheme } from 'react-native';

import { useSettings } from './hooks/useSettings';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Text/icons drawn on top of `accent`. */
  onAccent: string;
  danger: string;
  hudBg: string;
  /** 3D view background. */
  canvas: string;
};

export const dark: Palette = {
  bg: '#0f1419',
  surface: '#1a2129',
  surfaceAlt: '#232c36',
  border: '#2e3a47',
  text: '#e6edf3',
  textMuted: '#8b98a5',
  accent: '#4fc3f7',
  onAccent: '#00131c',
  danger: '#ef5350',
  hudBg: 'rgba(10, 14, 18, 0.72)',
  canvas: '#0f1419',
};

export const light: Palette = {
  bg: '#f3f5f8',
  surface: '#ffffff',
  surfaceAlt: '#e6ebf0',
  border: '#d3dbe3',
  text: '#15212c',
  textMuted: '#5a6977',
  accent: '#0277bd',
  onAccent: '#ffffff',
  danger: '#c62828',
  hudBg: 'rgba(255, 255, 255, 0.86)',
  canvas: '#e9eef3',
};

/** Active palette: the user's choice in Settings, or the phone's appearance when set to "system". */
export function useTheme(): { colors: Palette; isDark: boolean } {
  const { settings } = useSettings();
  const system = useColorScheme();
  const isDark = settings.theme === 'system' ? system !== 'light' : settings.theme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}

/** Builds a style hook whose StyleSheet is created once per palette. */
export function makeStyles<T>(factory: (colors: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return () => {
    const { colors } = useTheme();
    let styles = cache.get(colors);
    if (!styles) {
      styles = factory(colors);
      cache.set(colors, styles);
    }
    return styles;
  };
}
