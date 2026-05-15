import React, { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { Sk } from './Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface IStatistics {
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
  leaderboard: { name: string; count: number }[];
}
interface IMyStatistics {
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
}

const STAT_CARDS = [
  { key: 'thisWeekCount',  label: 'Наступні 7 днів',  icon: '📅', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  { key: 'thisMonthCount', label: 'Наступні 30 днів', icon: '📆', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { key: 'thisYearCount',  label: 'Наступні 365 днів',icon: '🗓️', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
];

const MEDAL = ['🥇', '🥈', '🥉'];
const BAR_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

export const StatisticsDashboard: React.FC = () => {
  const { isAuthenticated, role, token } = useAuth();
  const [stats, setStats]   = useState<IStatistics | IMyStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async (url: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await axios.get(url);
        setStats(response.data);
      } catch {
        setError('Помилка завантаження статистики.');
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      if (role) {
        fetchData(role === 'SOLDIER' ? '/api/statistics/my-summary' : '/api/statistics/summary');
      }
    } else {
      fetchData('/api/statistics/summary');
    }
  }, [isAuthenticated, role, token]);

  if (isLoading) return (
    <div className="stats-dashboard">
      <div className="stats-cards-row">
        {[0,1,2].map(i => (
          <div key={i} className="stats-big-card" style={{ borderTop: '4px solid var(--bs-border-color)' }}>
            <Sk w={44} h={44} r="12px" style={{ margin: '0 auto 0.75rem' }} />
            <Sk w={48} h="2rem" r="8px" style={{ margin: '0 auto 4px' }} />
            <Sk w="80%" h="0.72rem" r="6px" style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <div className="stats-leaderboard">
        <Sk w={100} h="0.72rem" r="6px" style={{ marginBottom: '1rem' }} />
        <Sk h={80} r="10px" style={{ marginBottom: '1rem' }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ display:'flex', gap:10, padding:'8px 10px', borderRadius:10, background:'var(--bs-tertiary-bg)', marginBottom:6 }}>
            <Sk w={22} h={22} r="50%" style={{ flexShrink: 0 }} />
            <Sk h="0.85rem" r="6px" style={{ flex: 1 }} />
            <Sk w={50} h="0.8rem" r="6px" style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
  if (error)  return <Alert variant="danger">{error}</Alert>;
  if (!stats) return null;

  const isSoldier = isAuthenticated && role === 'SOLDIER';
  const prefix    = isSoldier ? 'Моїх нарядів' : 'Запланованих нарядів';
  const leaderboard = 'leaderboard' in stats ? stats.leaderboard : [];

  return (
    <div className="stats-dashboard">

      {/* ── Три картки ── */}
      <div className="stats-cards-row">
        {STAT_CARDS.map(card => (
          <div key={card.key} className="stats-big-card" style={{ borderTop: `4px solid ${card.color}` }}>
            <div className="stats-big-card-icon" style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
            <div className="stats-big-card-num" style={{ color: card.color }}>
              {(stats as any)[card.key]}
            </div>
            <div className="stats-big-card-lbl">{prefix}<br />{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Лідерборд + бар-чарт (тільки не для солдата) ── */}
      {!isSoldier && leaderboard.length > 0 && (
        <div className="stats-leaderboard">
          <div className="stats-lb-title">Топ-3 за місяць</div>

          {/* Бар-чарт */}
          <div style={{ height: 120, marginBottom: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboard} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 11, fill: 'var(--bs-body-color)' }}
                  tickFormatter={n => n.split(' ')[0]}
                />
                <Tooltip
                  formatter={(v) => [`${v} нарядів`, '']}
                  contentStyle={{
                    background: 'var(--bs-body-bg)',
                    border: '1px solid var(--bs-border-color)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {leaderboard.map((_: any, i: number) => (
                    <Cell key={i} fill={BAR_COLORS[i] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Список з медалями */}
          <div className="stats-lb-list">
            {leaderboard.map((entry, i) => (
              <div key={i} className="stats-lb-row">
                <span className="stats-lb-medal">{MEDAL[i]}</span>
                <span className="stats-lb-name">{entry.name}</span>
                <span className="stats-lb-count" style={{ color: BAR_COLORS[i] }}>
                  {entry.count} нар.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
