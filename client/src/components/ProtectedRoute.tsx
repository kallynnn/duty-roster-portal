import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Отримуємо стан автентифікації
  const { isAuthenticated } = useAuth(); 

  // 2. ПРАВИЛЬНА ЛОГІКА:
  // Якщо користувач НЕ залогінений (зверни увагу на '!')
  if (!isAuthenticated) { 
    // ...тоді перенаправляємо його на сторінку входу
    return <Navigate to="/login" replace />;
  }

  // 3. Якщо він залогінений (isAuthenticated = true),
  // то 'if' не спрацює, і ми просто покажемо 'children' (тобто, DashboardPage)
  return <>{children}</>;
};