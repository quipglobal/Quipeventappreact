import React, { createContext, useContext, ReactNode } from 'react';
import { colors, spacing, radius, typography, shadows } from '@/constants/theme';

export interface AppTheme {
  colors: typeof colors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  isDark: boolean;
}

const theme: AppTheme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  isDark: true,
};

const ThemeContext = createContext<AppTheme>(theme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
