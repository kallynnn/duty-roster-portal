import React from 'react';
import { Container } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { StatisticsDashboard } from '../components/StatisticsDashboard';
import logo from '../mitit.png';

const ROLE_META: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  ADMIN:     { label: 'Адміністратор',       icon: '⚙️', color: '#7c3aed', desc: 'Повний доступ до системи' },
  COMMANDER: { label: 'Командир',            icon: '🛡️', color: '#1e3a5f', desc: 'Управління підрозділом'  },
  SOLDIER:   { label: 'Військовослужбовець', icon: '👤', color: '#16a34a', desc: 'Особистий кабінет'       },
};

export const HomePage: React.FC = () => {
  const { role, isAuthenticated } = useAuth();
  const meta = role ? (ROLE_META[role] ?? ROLE_META.SOLDIER) : null;

  return (
    <Container className="mt-3 mt-md-4 pb-4">

      {/* ── Hero-банер ── */}
      <div className="home-hero-v2">
        <div className="home-hero-v2-bg">
          <img src={logo} alt="" className="home-hero-v2-watermark" />
        </div>
        <div className="home-hero-v2-content">
          <div>
            <div className="home-hero-v2-eyebrow">Військовий інститут телекомунікацій та інформатизації</div>
            <h1 className="home-hero-v2-title">Графік чергувань</h1>
            <p className="home-hero-v2-sub">
              {isAuthenticated
                ? 'Актуальний розклад чергувань підрозділу'
                : 'Увійдіть для доступу до повного функціоналу'}
            </p>
          </div>
          {meta && (
            <div className="home-hero-v2-badge" style={{ borderColor: meta.color, color: meta.color }}>
              <span>{meta.icon}</span>
              <div>
                <div className="home-hero-v2-badge-label">{meta.label}</div>
                <div className="home-hero-v2-badge-desc">{meta.desc}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Статистика ── */}
      <div className="mb-4">
        <StatisticsDashboard />
      </div>

      {/* ── Календар ── */}
      <ScheduleCalendar scope="all" />
    </Container>
  );
};
