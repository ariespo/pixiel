import { useState, useEffect } from 'react';

export type Theme = 'coffee' | 'midnight' | 'emerald' | 'classic';
export type FontSize = 'small' | 'medium' | 'large';
export type FontType = 'pixel' | 'sans' | 'mono';

export interface AppSettings {
  theme: Theme;
  fontSize: FontSize;
  fontType: FontType;
}

const THEMES = {
  coffee: {
    bg: '#2d1b15',
    surface: '#efebe9',
    primary: '#3e2723',
    accent: '#ffb300',
    text: '#2d1b15',
    textLight: '#efebe9',
    border: '#3e2723',
    button: '#a1887f',
    buttonHover: '#bcaaa4',
  },
  midnight: {
    bg: '#0a0a0a',
    surface: '#1a1a1a',
    primary: '#121212',
    accent: '#3b82f6',
    text: '#e5e5e5',
    textLight: '#ffffff',
    border: '#333333',
    button: '#262626',
    buttonHover: '#404040',
  },
  emerald: {
    bg: '#064e3b',
    surface: '#ecfdf5',
    primary: '#065f46',
    accent: '#10b981',
    text: '#064e3b',
    textLight: '#ecfdf5',
    border: '#064e3b',
    button: '#34d399',
    buttonHover: '#6ee7b7',
  },
  classic: {
    bg: '#008080',
    surface: '#c0c0c0',
    primary: '#000080',
    accent: '#ffff00',
    text: '#000000',
    textLight: '#ffffff',
    border: '#000000',
    button: '#c0c0c0',
    buttonHover: '#dfdfdf',
  }
};

const FONT_SIZES = {
  small: '14px',
  medium: '16px',
  large: '20px',
};

const FONTS = {
  pixel: '"DotGothic16", monospace',
  sans: 'system-ui, sans-serif',
  mono: 'monospace',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app-settings');
    return saved ? JSON.parse(saved) : {
      theme: 'coffee',
      fontSize: 'medium',
      fontType: 'pixel',
    };
  });

  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
    
    const root = document.documentElement;
    const theme = THEMES[settings.theme];
    
    root.style.setProperty('--color-bg', theme.bg);
    root.style.setProperty('--color-surface', theme.surface);
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-text', theme.text);
    root.style.setProperty('--color-text-light', theme.textLight);
    root.style.setProperty('--color-border', theme.border);
    root.style.setProperty('--color-button', theme.button);
    root.style.setProperty('--color-button-hover', theme.buttonHover);
    
    root.style.setProperty('--font-size-base', FONT_SIZES[settings.fontSize]);
    root.style.setProperty('--font-main', FONTS[settings.fontType]);
  }, [settings]);

  return { settings, setSettings };
}
