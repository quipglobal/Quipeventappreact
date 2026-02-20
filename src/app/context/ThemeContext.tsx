/**
 * ThemeContext — Dark / Light design token system
 * ─────────────────────────────────────────────────
 * Dark:  cinematic black (#07070F) + violet accents
 * Light: clean lavender-tinted white + same violet accents
 *
 * Usage:  const { t, isDark, toggleTheme } = useTheme();
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface T {
  // ── Page & surfaces ─────────────────────────────────────────────────
  bgPage:      string;   // outer page background
  surface:     string;   // card / sheet backgrounds
  surface2:    string;   // subtle inner backgrounds, tags
  surfaceHov:  string;   // hover state on surfaces
  glass:       string;   // frosted glass surface
  // ── Borders ─────────────────────────────────────────────────────────
  border:      string;   // default border
  borderSub:   string;   // very subtle border
  borderAcc:   string;   // accent (violet) border
  // ── Text ────────────────────────────────────────────────────────────
  text:        string;   // primary
  textSec:     string;   // secondary
  textMuted:   string;   // muted / placeholder
  // ── Accent ──────────────────────────────────────────────────────────
  accent:      string;   // violet-600 — primary brand colour (same both modes)
  accentSoft:  string;   // violet-300 (dark) / violet-600 (light)
  accentBg:    string;   // very subtle accent tint
  // ── Status ──────────────────────────────────────────────────────────
  successBg:   string;
  successText: string;
  errorBg:     string;
  errorText:   string;
  warningBg:   string;
  warningText: string;
  // ── Input / form ────────────────────────────────────────────────────
  inputBg:     string;
  inputBorder: string;
  inputFocus:  string;
  // ── Nav ─────────────────────────────────────────────────────────────
  navBg:       string;
  navBorder:   string;
  navActive:   string;   // active icon/text colour
  navActiveBg: string;   // active tab pill
  navInactive: string;   // inactive icon/text colour
  // ── Misc ────────────────────────────────────────────────────────────
  shadow:      string;
  shadowHov:   string;
  divider:     string;
  emptyIcon:   string;
}

// ─── Dark tokens ───────────────────────────────────────────────────────────────
const dark: T = {
  bgPage:      '#07070F',
  surface:     '#111120',
  surface2:    'rgba(255,255,255,0.06)',
  surfaceHov:  'rgba(255,255,255,0.1)',
  glass:       'rgba(17,17,32,0.9)',
  border:      'rgba(255,255,255,0.08)',
  borderSub:   'rgba(255,255,255,0.05)',
  borderAcc:   'rgba(124,58,237,0.5)',
  text:        '#FFFFFF',
  textSec:     'rgba(255,255,255,0.55)',
  textMuted:   'rgba(255,255,255,0.28)',
  accent:      '#7c3aed',
  accentSoft:  '#c4b5fd',
  accentBg:    'rgba(124,58,237,0.15)',
  successBg:   'rgba(16,185,129,0.12)',
  successText: '#86efac',
  errorBg:     'rgba(239,68,68,0.12)',
  errorText:   '#fca5a5',
  warningBg:   'rgba(245,158,11,0.12)',
  warningText: '#fcd34d',
  inputBg:     'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputFocus:  'rgba(124,58,237,0.6)',
  navBg:       'rgba(7,7,15,0.97)',
  navBorder:   'rgba(255,255,255,0.08)',
  navActive:   '#a78bfa',
  navActiveBg: 'rgba(124,58,237,0.18)',
  navInactive: 'rgba(255,255,255,0.32)',
  shadow:      '0 4px 32px rgba(0,0,0,0.5)',
  shadowHov:   '0 8px 40px rgba(0,0,0,0.6)',
  divider:     'rgba(255,255,255,0.07)',
  emptyIcon:   'rgba(255,255,255,0.15)',
};

// ─── Light tokens ──────────────────────────────────────────────────────────────
const light: T = {
  bgPage:      '#F5F3FF',
  surface:     '#FFFFFF',
  surface2:    'rgba(124,58,237,0.05)',
  surfaceHov:  'rgba(124,58,237,0.08)',
  glass:       'rgba(255,255,255,0.95)',
  border:      'rgba(0,0,0,0.08)',
  borderSub:   'rgba(0,0,0,0.04)',
  borderAcc:   'rgba(124,58,237,0.35)',
  text:        '#09090F',
  textSec:     '#4B5563',
  textMuted:   '#9CA3AF',
  accent:      '#7c3aed',
  accentSoft:  '#7c3aed',
  accentBg:    'rgba(124,58,237,0.08)',
  successBg:   'rgba(16,185,129,0.08)',
  successText: '#059669',
  errorBg:     'rgba(239,68,68,0.08)',
  errorText:   '#DC2626',
  warningBg:   'rgba(245,158,11,0.08)',
  warningText: '#D97706',
  inputBg:     'rgba(0,0,0,0.04)',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputFocus:  'rgba(124,58,237,0.4)',
  navBg:       'rgba(255,255,255,0.97)',
  navBorder:   'rgba(0,0,0,0.07)',
  navActive:   '#7c3aed',
  navActiveBg: 'rgba(124,58,237,0.08)',
  navInactive: '#9CA3AF',
  shadow:      '0 4px 24px rgba(124,58,237,0.07)',
  shadowHov:   '0 8px 32px rgba(124,58,237,0.12)',
  divider:     'rgba(0,0,0,0.06)',
  emptyIcon:   'rgba(0,0,0,0.12)',
};

// ─── Context ───────────────────────────────────────────────────────────────────
interface ThemeCtx { mode: ThemeMode; t: T; isDark: boolean; toggleTheme: () => void; setTheme: (m: ThemeMode) => void; }
const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export const useTheme = (): ThemeCtx => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem('eh_theme') as ThemeMode) ?? 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('eh_theme', mode); } catch {}
  }, [mode]);

  const toggleTheme = () => setMode(m => m === 'dark' ? 'light' : 'dark');
  const t = mode === 'dark' ? dark : light;

  return (
    <ThemeContext.Provider value={{ mode, t, isDark: mode === 'dark', toggleTheme, setTheme: setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
