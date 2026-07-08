import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  effectiveTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chatbot_admin_theme');
    return (saved as ThemeMode) || 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => {
    const saved = (localStorage.getItem('chatbot_admin_theme') as ThemeMode) || 'system';
    const effective: 'light' | 'dark' =
      saved === 'system'
        ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : saved;
    // Apply immediately to avoid flash of unstyled theme
    document.documentElement.setAttribute('data-theme', effective);
    return effective;
  });

  const updateEffectiveTheme = (currentTheme: ThemeMode) => {
    if (currentTheme === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setEffectiveTheme(isDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      setEffectiveTheme(currentTheme);
      document.documentElement.setAttribute('data-theme', currentTheme);
    }
  };

  useEffect(() => {
    updateEffectiveTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateEffectiveTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('chatbot_admin_theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
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
