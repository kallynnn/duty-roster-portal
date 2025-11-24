import React from 'react';
import { Button } from 'react-bootstrap';
import { SunFill, MoonFill } from 'react-bootstrap-icons'; // Імпортуємо іконки
import { useTheme } from '../context/ThemeContext'; // Імпортуємо наш хук

export const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme(); // Отримуємо поточну тему

  return (
    <Button 
      variant="outline-secondary" 
      onClick={toggleTheme} // При кліку - змінюємо тему
      className="ms-2" // Додаємо відступ зліва
    >
      {theme === 'light' ? <MoonFill /> : <SunFill />} {/* Показуємо іконку залежно від теми */}
    </Button>
  );
};