'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

export const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
} as const;

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color =
      resolvedTheme === 'dark' ? META_THEME_COLORS.dark : META_THEME_COLORS.light;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [resolvedTheme]);

  return null;
}
