import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Theme = 'coffee' | 'cyberpunk' | 'retro';
export type Font = 'DotGothic16' | 'VT323' | 'PressStart2P' | 'MyMaruMonica' | 'UranusPixel' | 'BoutiqueBitmap';
type FontSize = 'small' | 'medium' | 'large';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  font: Font;
  setFont: (font: Font) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (model: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Font CSS variable values
const fontValues: Record<Font, string> = {
  DotGothic16: '"DotGothic16", monospace',
  VT323: '"VT323", monospace',
  PressStart2P: '"Press Start 2P", monospace',
  MyMaruMonica: '"x12y16MyMaruMonica", "DotGothic16", monospace',
  UranusPixel: '"Uranus Pixel 11Px", "DotGothic16", monospace',
  BoutiqueBitmap: '"BoutiqueBitmap9x9", "DotGothic16", monospace',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('elysium_theme') as Theme) || 'coffee';
  });
  const [font, setFont] = useState<Font>(() => {
    return (localStorage.getItem('elysium_font') as Font) || 'BoutiqueBitmap';
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('elysium_font_size') as FontSize) || 'medium';
  });

  // API Settings
  const [apiUrl, setApiUrl] = useState<string>(localStorage.getItem('elysium_api_url') || '');
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('elysium_api_key') || '');
  const [model, setModel] = useState<string>(localStorage.getItem('elysium_model') || 'gemini-3.1-pro-preview');

  // Apply font globally
  useEffect(() => {
    document.documentElement.style.setProperty('--font-pixel', fontValues[font]);
  }, [font]);

  // Apply font size globally
  useEffect(() => {
    const sizeMap = { small: '14px', medium: '16px', large: '20px' };
    document.documentElement.style.setProperty('--app-font-size', sizeMap[fontSize]);
  }, [fontSize]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('elysium_theme', theme);
    localStorage.setItem('elysium_font', font);
    localStorage.setItem('elysium_font_size', fontSize);
    localStorage.setItem('elysium_api_url', apiUrl);
    localStorage.setItem('elysium_api_key', apiKey);
    localStorage.setItem('elysium_model', model);
  }, [theme, font, fontSize, apiUrl, apiKey, model]);

  return (
    <SettingsContext.Provider value={{
      theme, setTheme,
      font, setFont,
      fontSize, setFontSize,
      apiUrl, setApiUrl,
      apiKey, setApiKey,
      model, setModel
    }}>
      <div className={`theme-${theme} size-${fontSize} h-full w-full relative`}>
        {children}
      </div>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
