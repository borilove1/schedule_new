import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    // 모바일 상태바 색상 업데이트 (헤더 색상과 맞춤)
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.content = isDarkMode ? '#1e293b' : '#ffffff';
    }
    // body 배경색 업데이트
    document.body.style.backgroundColor = isDarkMode ? '#0f172a' : '#f8fafc';
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => setIsDarkMode(prev => !prev), []);

  const value = useMemo(() => ({ isDarkMode, toggleDarkMode }), [isDarkMode, toggleDarkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
