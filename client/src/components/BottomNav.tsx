import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return null;

  const isCommander = ['SQUAD_COMMANDER','GROUP_COMMANDER','COURSE_SERGEANT','COURSE_HEAD','FACULTY_HEAD','ADMIN'].includes(role || '');

  const navItems = isCommander
    ? [
        { to: '/',          icon: '📅', label: 'Графік'  },
        { to: '/duty-map',  icon: '🗺️', label: 'Карта'   },
        { to: '/dashboard', icon: '🛡️', label: 'Панель'  },
        { to: '/profile',   icon: '👤', label: 'Профіль' },
      ]
    : [
        { to: '/',            icon: '📅', label: 'Графік'     },
        { to: '/my-schedule', icon: '📋', label: 'Мій графік' },
        { to: '/profile',     icon: '👤', label: 'Профіль'    },
        { to: '/contact',     icon: '✉️', label: 'Контакти'   },
      ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon-pill">
              <span className="bottom-nav-icon">{item.icon}</span>
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};