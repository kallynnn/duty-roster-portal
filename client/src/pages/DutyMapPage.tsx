import React, { useState, useEffect, useMemo } from 'react';
import { Container, Alert } from 'react-bootstrap';
import axios from 'axios';
import { Sk } from '../components/Skeleton';

interface DutyEntry {
  id: number;
  soldier: {
    id: number;
    name: string;
    rank: string;
    platoon: string | null;
    squad: string | null;
    company: string | null;
    status: string;
  };
  dutyType: { name: string };
}

const getDutyColor = (name: string): { bg: string; text: string } => {
  const n = name.toLowerCase();
  if (n.includes('пожежний'))                        return { bg: '#ef4444', text: '#fff' };
  if (n.includes('кпп') || n.includes('пропускн'))   return { bg: '#f97316', text: '#fff' };
  if (n.includes('курсу') || n.includes('підрозділ')) return { bg: '#16a34a', text: '#fff' };
  if (n.includes('навч. корп'))                      return { bg: '#0891b2', text: '#fff' };
  if (n.includes('штабу'))                           return { bg: '#7c3aed', text: '#fff' };
  if (n.includes('гуртожитку'))                      return { bg: '#ca8a04', text: '#fff' };
  if (n.includes('парку'))                           return { bg: '#0d9488', text: '#fff' };
  return { bg: '#3b82f6', text: '#fff' };
};

const STATUS_COLOR: Record<string, string> = { ACTIVE: '#22c55e', SICK: '#ef4444', LEAVE: '#f59e0b' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'В строю', SICK: 'Хворий', LEAVE: 'Відпустка' };

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const todayStr = toDateStr(new Date());

const DutyMapSkeleton: React.FC = () => (
  <div>
    {[0, 1, 2].map(p => (
      <div key={p} className="dmap-platoon">
        <div className="dmap-platoon-title">
          <Sk w={120} h={20} r="8px" />
        </div>
        <div className="dmap-cards-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="dmap-card" style={{ borderLeft: '4px solid var(--bs-border-color)' }}>
              <Sk w="70%" h="0.75rem" r="6px" style={{ marginBottom: 8 }} />
              <Sk w="90%" h="1rem" r="6px" style={{ marginBottom: 6 }} />
              <Sk w="50%" h="0.72rem" r="6px" style={{ marginBottom: 8 }} />
              <Sk w={80} h={20} r="20px" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const DutyMapPage: React.FC = () => {
  const [date,    setDate]    = useState(new Date());
  const [entries, setEntries] = useState<DutyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const dateStr = useMemo(() => toDateStr(date), [date]);

  useEffect(() => {
    setLoading(true);
    setError('');
    axios.get(`/api/schedule/duty-map?date=${dateStr}`)
      .then(r => setEntries(r.data))
      .catch(() => setError('Не вдалося завантажити дані'))
      .finally(() => setLoading(false));
  }, [dateStr]);

  const goDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d);
  };

  const grouped = useMemo(() => {
    const map: Record<string, DutyEntry[]> = {};
    entries.forEach(e => {
      const key = e.soldier.platoon ?? 'Без взводу';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [entries]);

  const platoons = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      if (a === 'Без взводу') return 1;
      if (b === 'Без взводу') return -1;
      return a.localeCompare(b, 'uk');
    }), [grouped]
  );

  const isToday = dateStr === todayStr;
  const formattedDate = date.toLocaleDateString('uk-UA', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Count by duty type for summary
  const dutySummary = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      map[e.dutyType.name] = (map[e.dutyType.name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  return (
    <Container>
      <div className="dmap-page">

        {/* ── Заголовок + навігація ── */}
        <div className="dmap-header">
          <div className="dmap-header-top">
            <div>
              <div className="dmap-eyebrow">Поточна доба</div>
              <h2 className="dmap-title">Карта чергувань</h2>
            </div>
            {!loading && (
              <div className="dmap-total-badge">
                <span className="dmap-total-num">{entries.length}</span>
                <span className="dmap-total-lbl">на варті</span>
              </div>
            )}
          </div>

          <div className="dmap-nav-row">
            <button className="dmap-nav-btn" onClick={() => goDay(-1)}>‹ Попередній</button>
            <div className="dmap-date-display">
              <span className="dmap-date-text">{formattedDate}</span>
              {isToday && <span className="dmap-today-chip">Сьогодні</span>}
            </div>
            <button className="dmap-nav-btn" onClick={() => goDay(1)}>Наступний ›</button>
          </div>

          {!isToday && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button className="dmap-return-btn" onClick={() => setDate(new Date())}>
                ↩ Повернутись до сьогодні
              </button>
            </div>
          )}
        </div>

        {/* ── Зведення по типах нарядів ── */}
        {!loading && dutySummary.length > 0 && (
          <div className="dmap-summary">
            {dutySummary.map(([name, count]) => {
              const { bg } = getDutyColor(name);
              return (
                <div key={name} className="dmap-summary-chip" style={{ borderColor: bg, color: bg }}>
                  <span className="dmap-summary-dot" style={{ background: bg }} />
                  <span className="dmap-summary-name">{name}</span>
                  <span className="dmap-summary-count" style={{ background: bg }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Контент ── */}
        {loading ? (
          <DutyMapSkeleton />
        ) : error ? (
          <Alert variant="danger">{error}</Alert>
        ) : entries.length === 0 ? (
          <div className="dmap-empty">
            <div className="dmap-empty-icon">📭</div>
            <div className="dmap-empty-title">Нарядів не заплановано</div>
            <div className="dmap-empty-sub">На {formattedDate} графік порожній</div>
          </div>
        ) : (
          platoons.map(platoon => {
            const pl = grouped[platoon];
            // Group by duty type within platoon
            const byDuty: Record<string, DutyEntry[]> = {};
            pl.forEach(e => {
              if (!byDuty[e.dutyType.name]) byDuty[e.dutyType.name] = [];
              byDuty[e.dutyType.name].push(e);
            });

            return (
              <div key={platoon} className="dmap-platoon">
                <div className="dmap-platoon-title">
                  <span className="dmap-platoon-icon">🔹</span>
                  {platoon === 'Без взводу' ? 'Без взводу' : `${platoon} Взвод`}
                  <span className="dmap-platoon-count">{pl.length} ос.</span>
                </div>

                <div className="dmap-cards-grid">
                  {pl.map(entry => {
                    const { bg } = getDutyColor(entry.dutyType.name);
                    return (
                      <div key={entry.id} className="dmap-card" style={{ borderLeft: `4px solid ${bg}` }}>
                        <div className="dmap-card-post" style={{ color: bg }}>
                          {entry.dutyType.name}
                        </div>
                        <div className="dmap-card-soldier">{entry.soldier.name}</div>
                        <div className="dmap-card-sub">
                          {entry.soldier.rank}
                          {entry.soldier.squad && ` · Відд. ${entry.soldier.squad}`}
                        </div>
                        <div className="dmap-card-status">
                          <span
                            className="dmap-status-dot"
                            style={{ background: STATUS_COLOR[entry.soldier.status] ?? '#9ca3af' }}
                          />
                          <span>{STATUS_LABEL[entry.soldier.status] ?? entry.soldier.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

      </div>
    </Container>
  );
};
