import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Захищає сторінки ТІЛЬКИ для COMMANDER та ADMIN
// STARSHYNA і SOLDIER — перенаправляються на /profile
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role, token } = useAuth();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'COMMANDER' || role === 'ADMIN') {
    return <>{children}</>;
  }

  // STARSHYNA і SOLDIER — тільки особистий кабінет
  return <Navigate to="/profile" replace />;
};