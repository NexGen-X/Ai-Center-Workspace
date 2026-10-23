import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme, ACCENT_THEMES, ThemeMode, AccentColor } from '../context/ThemeContext';

interface ThemeSelectorProps {
  compact?: boolean;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ compact = false, className = '' }) => {
  const { themeMode, resolvedMode, accentColor, setThemeMode, setAccentColor, accent } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Sesuaikan Tema & Warna Estetika Platform"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-[#0a0a0a] hover:bg-neutral-200 dark:hover:bg-neutral-900 border border-neutral-300 dark:border-zinc-800 text-neutral-700 dark:text-neutral-300 transition text-xs font-medium shadow-sm"
      >
        <span 
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
          style={{ backgroundColor: accent.hex }} 
        />
        {resolvedMode === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
        {!compact && (
          <>
            <span className="hidden sm:inline font-mono text-[11px] capitalize">{accent.name.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </>
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#09090b] border border-neutral-200 dark:border-zinc-800 shadow-2xl p-4 space-y-4 z-50 animate-fadeIn text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
              <Palette className="w-4 h-4 text-zinc-400" />
              <span>Personalisasi Tema</span>
            </div>
            <span className="text-[10px] font-mono uppercase text-zinc-400">UI / UX</span>
          </div>

          {/* Theme Mode Selector (Dark, Light, System) */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">Mode Tampilan</span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-black/80 border border-neutral-200 dark:border-zinc-800">
              <button
                onClick={() => setThemeMode('dark')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] font-medium ${
                  themeMode === 'dark'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Gelap</span>
              </button>

              <button
                onClick={() => setThemeMode('light')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] font-medium ${
                  themeMode === 'light'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Terang</span>
              </button>

              <button
                onClick={() => setThemeMode('system')}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] font-medium ${
                  themeMode === 'system'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Aesthetic Accent Color Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Aksen Estetika</span>
              <span className="text-[10px] font-mono text-zinc-400">{accent.label}</span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {(Object.keys(ACCENT_THEMES) as AccentColor[]).map((key) => {
                const conf = ACCENT_THEMES[key];
                const isSelected = accentColor === key;
                return (
                  <button
                    key={key}
                    onClick={() => setAccentColor(key)}
                    title={`${conf.name} (${conf.label})`}
                    className={`group relative h-8 rounded-xl flex items-center justify-center transition border ${
                      isSelected
                        ? 'border-neutral-900 dark:border-white ring-2 ring-white/20'
                        : 'border-transparent hover:border-neutral-300 dark:hover:border-zinc-700'
                    }`}
                    style={{ backgroundColor: conf.hex }}
                  >
                    {isSelected && (
                      <Check className={`w-3.5 h-3.5 ${key === 'monochrome' ? 'text-black' : 'text-white'} drop-shadow`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Info Footer */}
          <div className="pt-2 border-t border-neutral-100 dark:border-zinc-800/80 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
            <span>Disimpan di LocalStorage</span>
            <span className="text-emerald-500 dark:text-emerald-400 font-semibold">Instan</span>
          </div>
        </div>
      )}
    </div>
  );
};
