import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';

// Описуємо, що буде зберігати наш Контекст
interface IThemeContext {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Створюємо Контекст
const ThemeContext = createContext<IThemeContext | null>(null);

// Функція, що зчитує тему з localStorage
const getInitialTheme = (): 'light' | 'dark' => {
  const storedTheme = localStorage.getItem('theme');
  return storedTheme === 'dark' ? 'dark' : 'light';
};

// Створюємо Провайдер
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  // Функція перемикання
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Ефект, який спрацьовує, коли 'theme' змінюється
  useEffect(() => {
    // 1. Зберігаємо вибір у localStorage
    localStorage.setItem('theme', theme);

    // 2. ЗАСТОСОВУЄМО ТЕМУ до всього сайту
    // Це "чарівний" атрибут, який розуміє Bootstrap
    document.documentElement.setAttribute('data-bs-theme', theme);

  }, [theme]); // Запускати щоразу, коли 'theme' змінився

  // 'useMemo' - для оптимізації, щоб не створювати новий об'єкт при кожному рендері
  const value = useMemo(() => ({
    theme,
    toggleTheme
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Створюємо хук для легкого доступу
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};