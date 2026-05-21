import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Ролі, які мають доступ до Dashboard / DutyMap
const DASHBOARD_ROLES = [
  'SQUAD_COMMANDER',
  'GROUP_COMMANDER',
  'COURSE_SERGEANT',
  'COURSE_HEAD',
  'FACULTY_HEAD',
  'ADMIN',
];

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role, token, isFirstLogin } = useAuth();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (isFirstLogin) {
    return <Navigate to="/onboarding" replace />;
  }

  if (role && DASHBOARD_ROLES.includes(role)) {
    return <>{children}</>;
  }

  // CADET — тільки особистий кабінет
  return <Navigate to="/profile" replace />;
};
