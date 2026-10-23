import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'emerald' | 'monochrome' | 'charcoal' | 'amber' | 'violet' | 'cyan';

export interface AccentThemeConfig {
  id: AccentColor;
  name: string;
  label: string;
  hex: string;
  primaryBg: string;
  primaryHover: string;
  primaryText: string;
  primaryBorder: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  glowShadow: string;
  accentHex: string;
}

export const ACCENT_THEMES: Record<AccentColor, AccentThemeConfig> = {
  emerald: {
    id: 'emerald',
    name: 'Railway Cyber',
    label: 'Emerald Mint',
    hex: '#10B981',
    primaryBg: 'bg-emerald-500',
    primaryHover: 'hover:bg-emerald-400',
    primaryText: 'text-emerald-500 dark:text-emerald-400',
    primaryBorder: 'border-emerald-500/40',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    glowShadow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    accentHex: '#10B981'
  },
  monochrome: {
    id: 'monochrome',
    name: 'Vercel Titanium',
    label: 'Pure Monochrome',
    hex: '#FFFFFF',
    primaryBg: 'bg-black dark:bg-white',
    primaryHover: 'hover:bg-neutral-800 dark:hover:bg-neutral-200',
    primaryText: 'text-black dark:text-white',
    primaryBorder: 'border-neutral-300 dark:border-neutral-700',
    badgeBg: 'bg-neutral-100 dark:bg-white/10',
    badgeText: 'text-neutral-900 dark:text-neutral-200',
    badgeBorder: 'border-neutral-300 dark:border-white/15',
    glowShadow: 'shadow-[0_0_20px_rgba(255,255,255,0.2)]',
    accentHex: '#FFFFFF'
  },
  charcoal: {
    id: 'charcoal',
    name: 'Obsidian Charcoal',
    label: 'Dark Slate Gray',
    hex: '#52525B',
    primaryBg: 'bg-neutral-800 dark:bg-neutral-700',
    primaryHover: 'hover:bg-neutral-700 dark:hover:bg-neutral-600',
    primaryText: 'text-neutral-800 dark:text-neutral-200',
    primaryBorder: 'border-neutral-500/40',
    badgeBg: 'bg-neutral-500/10 dark:bg-neutral-800/60',
    badgeText: 'text-neutral-800 dark:text-neutral-200',
    badgeBorder: 'border-neutral-500/30',
    glowShadow: 'shadow-[0_0_20px_rgba(82,82,91,0.35)]',
    accentHex: '#52525B'
  },
  amber: {
    id: 'amber',
    name: 'Supabase Sunset',
    label: 'Executive Gold',
    hex: '#F59E0B',
    primaryBg: 'bg-amber-500',
    primaryHover: 'hover:bg-amber-400',
    primaryText: 'text-amber-600 dark:text-amber-400',
    primaryBorder: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-950/40',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-500/30',
    glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
    accentHex: '#F59E0B'
  },
  violet: {
    id: 'violet',
    name: 'Linear Nebula',
    label: 'Deep Violet',
    hex: '#8B5CF6',
    primaryBg: 'bg-violet-600',
    primaryHover: 'hover:bg-violet-500',
    primaryText: 'text-violet-600 dark:text-violet-400',
    primaryBorder: 'border-violet-500/40',
    badgeBg: 'bg-violet-500/10 dark:bg-violet-950/40',
    badgeText: 'text-violet-600 dark:text-violet-400',
    badgeBorder: 'border-violet-500/30',
    glowShadow: 'shadow-[0_0_20px_rgba(139,92,246,0.3)]',
    accentHex: '#8B5CF6'
  },
  cyan: {
    id: 'cyan',
    name: 'Azure Ocean',
    label: 'Electric Cyan',
    hex: '#06B6D4',
    primaryBg: 'bg-cyan-500',
    primaryHover: 'hover:bg-cyan-400',
    primaryText: 'text-cyan-600 dark:text-cyan-400',
    primaryBorder: 'border-cyan-500/40',
    badgeBg: 'bg-cyan-500/10 dark:bg-cyan-950/40',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    badgeBorder: 'border-cyan-500/30',
    glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
    accentHex: '#06B6D4'
  }
};

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  accentColor: AccentColor;
  accent: AccentThemeConfig;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (accent: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('idtech_theme_mode') || localStorage.getItem('idtech_app_theme_mode');
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    }
    return 'dark'; // Vercel & Railway Pitch Black
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('idtech_theme_accent') || localStorage.getItem('idtech_app_theme_accent');
      if (saved && ACCENT_THEMES[saved as AccentColor]) return saved as AccentColor;
    }
    return 'emerald'; // Default to Railway Cyber Emerald
  });

  const [resolvedMode, setResolvedMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const updateResolvedMode = () => {
      let activeMode: 'dark' | 'light' = 'dark';
      if (themeMode === 'system') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeMode = isSystemDark ? 'dark' : 'light';
      } else {
        activeMode = themeMode;
      }

      setResolvedMode(activeMode);

      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(activeMode);

      Object.keys(ACCENT_THEMES).forEach(c => root.classList.remove(`theme-${c}`));
      root.classList.add(`theme-${accentColor}`);

      root.style.setProperty('--accent-color', ACCENT_THEMES[accentColor].hex);
    };

    updateResolvedMode();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateResolvedMode();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode, accentColor]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('idtech_theme_mode', mode);
      localStorage.setItem('idtech_app_theme_mode', mode);
    }
  };

  const setAccentColor = (accent: AccentColor) => {
    setAccentColorState(accent);
    if (typeof window !== 'undefined') {
      localStorage.setItem('idtech_theme_accent', accent);
      localStorage.setItem('idtech_app_theme_accent', accent);
    }
  };

  const toggleTheme = () => {
    if (resolvedMode === 'dark') setThemeMode('light');
    else setThemeMode('dark');
  };

  const accent = ACCENT_THEMES[accentColor] || ACCENT_THEMES.emerald;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedMode,
        accentColor,
        accent,
        setThemeMode,
        setAccentColor,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
