import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Цей компонент захищає сторінки ТІЛЬКИ для Адмінів/Командирів
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role, token } = useAuth();

  if (!isAuthenticated || !token) {
    // Якщо не залогінений - відправляємо на логін
    return <Navigate to="/login" replace />;
  }

  if (role !== 'COMMANDER' && role !== 'ADMIN') {
    // Якщо залогінений, АЛЕ роль НЕ 'COMMANDER' (тобто, звичайний 'SOLDIER')
    // відправляємо його на сторінку "Мій Графік"
    return <Navigate to="/my-schedule" replace />;
  }

  // Якщо залогінений І роль правильна - пускаємо
  return <>{children}</>;
};