import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/uk';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useFetchData } from '../hooks/useFetchData';
import { Button, Modal, Form, Badge } from 'react-bootstrap';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { ExportPdfButton } from './ExportPdfButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

moment.locale('uk');
const localizer = momentLocalizer(moment);

interface IScheduleEvent {
  id: number;
  date: string;
  dutyTypeId: number;
  soldier: { name: string };
  dutyType: { name: string };
}

interface ICalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  dutyTypeId: number;
  dutyTypeName: string;
  soldierName: string;
}

interface ScheduleCalendarProps {
  scope: 'all' | 'mine';
}

const getDutyColor = (name: string): { bg: string; text: string } => {
  const n = name.toLowerCase();
  if (n.includes('пожежний'))                       return { bg: '#ef4444', text: '#fff' };
  if (n.includes('кпп') || n.includes('пропускн'))  return { bg: '#f97316', text: '#fff' };
  if (n.includes('курсу') || n.includes('підрозділ')) return { bg: '#16a34a', text: '#fff' };
  if (n.includes('навч. корп'))                     return { bg: '#0891b2', text: '#fff' };
  if (n.includes('штабу'))                          return { bg: '#7c3aed', text: '#fff' };
  if (n.includes('гуртожитку'))                     return { bg: '#ca8a04', text: '#fff' };
  if (n.includes('парку'))                          return { bg: '#0d9488', text: '#fff' };
  return { bg: '#3b82f6', text: '#fff' };
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

const MobileScheduleView: React.FC<{
  events: ICalendarEvent[];
  currentMonth: Date;
  onMonthChange: (d: Date) => void;
  onEventClick: (e: ICalendarEvent) => void;
}> = ({ events, currentMonth, onMonthChange, onEventClick }) => {
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const monthStart = moment(currentMonth).startOf('month');
  const monthEnd   = moment(currentMonth).endOf('month');

  const daysWithDuties = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => {
      if (moment(e.start).isBetween(monthStart, monthEnd, 'day', '[]'))
        set.add(moment(e.start).format('YYYY-MM-DD'));
    });
    return set;
  }, [events, currentMonth, monthStart, monthEnd]);

  const calDays = useMemo(() => {
    const days: (Date | null)[] = [];
    const start    = moment(currentMonth).startOf('month');
    const firstDow = (start.day() + 6) % 7;
    for (let i = 0; i < firstDow; i++) days.push(null);
    for (let d = 1; d <= monthEnd.date(); d++)
      days.push(moment(currentMonth).date(d).toDate());
    return days;
  }, [currentMonth, monthEnd]);

  const selectedEvents = selectedDay
    ? events.filter(e => moment(e.start).isSame(selectedDay, 'day'))
    : [];

  return (
    <div className="mob-cal-wrap">
      <div className="mob-cal-header">
        <button className="mob-cal-nav" onClick={() => onMonthChange(moment(currentMonth).subtract(1, 'month').toDate())}>‹</button>
        <span className="mob-cal-month">{moment(currentMonth).format('MMMM YYYY')}</span>
        <button className="mob-cal-nav" onClick={() => onMonthChange(moment(currentMonth).add(1, 'month').toDate())}>›</button>
      </div>
      <div className="mob-cal-grid">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => (
          <div key={d} className="mob-cal-dayname">{d}</div>
        ))}
        {calDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const key        = moment(day).format('YYYY-MM-DD');
          const isToday    = moment(day).isSame(moment(), 'day');
          const isSelected = selectedDay && moment(day).isSame(selectedDay, 'day');
          const hasDuty    = daysWithDuties.has(key);
          return (
            <div
              key={key}
              className={`mob-cal-day${hasDuty ? ' has-duty' : ''}${isToday ? ' is-today' : ''}${isSelected && !isToday ? ' is-selected' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
      <div className="mob-events">
        <div className="mob-day-title">
          {selectedDay ? moment(selectedDay).format('D MMMM, dddd') : 'Оберіть день'}
        </div>
        {selectedEvents.length === 0 ? (
          <div className="mob-empty">Нарядів немає</div>
        ) : (
          selectedEvents.map(e => {
            const color = getDutyColor(e.dutyTypeName);
            return (
              <div key={e.id} className="mob-event-row" onClick={() => onEventClick(e)}>
                <div className="mob-event-dot" style={{ background: color.bg }} />
                <div>
                  <div className="mob-event-duty">{e.dutyTypeName}</div>
                  <div className="mob-event-soldier">{e.soldierName}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface TooltipState { event: ICalendarEvent; x: number; y: number; }

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ scope }) => {
  const { showToast } = useToast();
  const { ask }       = useConfirm();
  const { role }      = useAuth();
  const isMobile      = useIsMobile();
  const isCommander   = role === 'COMMANDER' || role === 'ADMIN';
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const apiUrl = scope === 'all' ? '/api/schedule' : '/api/schedule/my-schedule';
  const { data: scheduleEvents, isLoading, refetch } = useFetchData<IScheduleEvent[]>(
    apiUrl, { allowGuest: scope === 'all' }
  );

  const [calDate,    setCalDate]    = useState(new Date());
  const [view,       setView]       = useState<View>('month');
  const [isUpdating, setIsUpdating] = useState(false);
  const [exportDate, setExportDate] = useState('');

  const [showSwapModal,  setShowSwapModal]  = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyDate,      setDailyDate]      = useState<Date | null>(null);
  const [dailyEvents,    setDailyEvents]    = useState<ICalendarEvent[]>([]);
  const [swapDate,           setSwapDate]           = useState<Date | null>(null);
  const [selectedDutyTypeId, setSelectedDutyTypeId] = useState('');
  const [targetScheduleId,   setTargetScheduleId]   = useState<number | null>(null);
  const [soldiersList,       setSoldiersList]        = useState<any[]>([]);
  const [newSoldierId,       setNewSoldierId]        = useState('');

  const events: ICalendarEvent[] = useMemo(() =>
    (scheduleEvents ?? []).map(e => ({
      id: e.id, title: e.soldier.name,
      start: new Date(e.date), end: new Date(e.date),
      dutyTypeId: e.dutyTypeId, dutyTypeName: e.dutyType.name, soldierName: e.soldier.name,
    })), [scheduleEvents]
  );

  const CustomCalEvent = useCallback(({ event }: { event: ICalendarEvent }) => (
    <div
      className="cal-event-inner"
      onMouseEnter={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ event, x: r.left + r.width / 2, y: r.top });
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      {event.soldierName}
    </div>
  ), []);

  const calComponents = useMemo(() => ({ event: CustomCalEvent }), [CustomCalEvent]);

  const openDailyModal = (evList: ICalendarEvent[], date: Date) => {
    setDailyDate(date); setDailyEvents(evList); setShowDailyModal(true);
  };

  const handleShowMore   = (evList: any[], date: Date) => openDailyModal(evList, date);
  const handleSelectSlot = ({ start }: { start: Date }) =>
    openDailyModal(events.filter(e => e.start.toDateString() === start.toDateString()), start);

  const handleRefresh = () => ask({
    title: 'Оновити календар?', message: 'Завантажити свіжі дані з сервера?',
    onConfirm: async () => {
      setIsUpdating(true);
      try   { await refetch(); showToast('Дані оновлено', 'success'); }
      catch { showToast('Помилка при оновленні', 'danger'); }
      finally { setIsUpdating(false); }
    }
  });

  const handleGenerate = () => {
    const month = calDate.getMonth() + 1;
    const year  = calDate.getFullYear();
    ask({
      title: 'Підтвердити генерацію',
      message: `Згенерувати графік на ${moment(calDate).format('MMMM YYYY')}? Старий буде видалено.`,
      onConfirm: async () => {
        try {
          const r = await axios.post('/api/schedule/generate', { month, year });
          showToast(r.data.message, 'success'); refetch();
        } catch (e: any) {
          showToast(e.response?.data?.message || 'Помилка генерації', 'danger');
        }
      }
    });
  };

  const handleEventClick = async (event: ICalendarEvent) => {
    if (!isCommander) {
      openDailyModal(events.filter(e => e.start.toDateString() === event.start.toDateString()), event.start);
      return;
    }
    setSwapDate(event.start);
    setSelectedDutyTypeId(event.dutyTypeId?.toString() || '');
    setTargetScheduleId(event.id);
    setNewSoldierId('');
    setShowSwapModal(true);
    try {
      const res = await axios.get('/api/soldiers');
      setSoldiersList(res.data.filter((s: any) => s.status === 'ACTIVE'));
    } catch { showToast('Не вдалося завантажити список особового складу', 'danger'); }
  };

  const handleSwapSubmit = async () => {
    if (!targetScheduleId) return showToast('Оберіть, кого знімаємо!', 'warning');
    if (!newSoldierId)     return showToast('Оберіть нового чергового!', 'warning');
    try {
      await axios.put(`/api/schedule/${targetScheduleId}`, { newSoldierId });
      setShowSwapModal(false); showToast('Заміну виконано', 'success'); refetch();
    } catch { showToast('Помилка при заміні', 'danger'); }
  };

  const exportToExcel = () => {
    let filtered = events;
    if (exportDate) filtered = events.filter(e => moment(e.start).format('YYYY-MM-DD') === exportDate);
    if (filtered.length === 0) {
      showToast(exportDate ? `На ${moment(exportDate).format('DD.MM.YYYY')} нарядів немає` : 'Графік порожній', 'warning');
      return;
    }
    const data = filtered.map(e => ({
      'Дата': moment(e.start).format('DD.MM.YYYY'),
      'Військовослужбовець': e.soldierName,
      'Вид наряду': e.dutyTypeName,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, exportDate ? 'Витяг' : 'Графік');
    XLSX.writeFile(wb, exportDate
      ? `Dobova_${moment(exportDate).format('DD_MM_YYYY')}.xlsx`
      : `Hrafik_${moment(calDate).format('MM_YYYY')}.xlsx`
    );
  };

  const eventStyleGetter = (event: ICalendarEvent) => {
    const { bg, text } = getDutyColor(event.dutyTypeName);
    return { style: { backgroundColor: bg, color: text, borderRadius: '5px', border: 'none', fontSize: '11px', padding: '2px 6px', fontWeight: '500', opacity: 0.92 } };
  };

  const groupedDaily = useMemo(() => {
    const map: Record<string, { soldierName: string; id: number }[]> = {};
    dailyEvents.forEach(e => {
      if (!map[e.dutyTypeName]) map[e.dutyTypeName] = [];
      map[e.dutyTypeName].push({ soldierName: e.soldierName, id: e.id });
    });
    return map;
  }, [dailyEvents]);

  const monthStats = useMemo(() => {
    const start = moment(calDate).startOf('month');
    const end   = moment(calDate).endOf('month');
    const inMonth = events.filter(e => moment(e.start).isBetween(start, end, 'day', '[]'));
    const counts: Record<string, number> = {};
    inMonth.forEach(e => { counts[e.soldierName] = (counts[e.soldierName] || 0) + 1; });
    return { total: inMonth.length, unique: Object.keys(counts).length };
  }, [events, calDate]);

  return (
    <>
      <div className="cal-wrap">

        {/* ── Панель керування ── */}
        {scope === 'all' && isCommander && (
          <div className="cal-controls">
            <div className="cal-controls-left">
              <button className="cal-btn cal-btn-generate" onClick={handleGenerate}>
                ⚡ Згенерувати графік
              </button>
              <button className="cal-btn cal-btn-refresh" onClick={handleRefresh} disabled={isUpdating || isLoading}>
                {isUpdating ? '⏳ Зачекайте...' : '🔄 Оновити'}
              </button>
            </div>
            <div className="cal-controls-right">
              <input
                type="date"
                value={exportDate}
                onChange={e => setExportDate(e.target.value)}
                style={{ borderRadius: '10px', border: '1px solid var(--bs-border-color)', padding: '6px 10px', fontSize: '0.82rem', background: 'var(--bs-body-bg)', color: 'var(--bs-body-color)' }}
                title="Оберіть день для витягу"
              />
              {/* Excel */}
              <button className="cal-btn cal-btn-export" onClick={exportToExcel} disabled={events.length === 0}>
                {exportDate ? '📥 Excel витяг' : '📥 Excel витяг'}
              </button>
              {/* PDF — тільки коли обрана дата */}
              {exportDate && (
                <ExportPdfButton date={exportDate} label="Наказ PDF" />
              )}
            </div>
          </div>
        )}

        {/* ── Статистика ── */}
        {!isLoading && events.length > 0 && (
          <div className="cal-stats">
            <div className="cal-stat"><span className="cal-stat-num">{monthStats.total}</span><span className="cal-stat-lbl">Нарядів</span></div>
            <div className="cal-stat"><span className="cal-stat-num">{monthStats.unique}</span><span className="cal-stat-lbl">Чергових</span></div>
            <div className="cal-stat"><span className="cal-stat-num">{moment(calDate).format('MMM')}</span><span className="cal-stat-lbl">Місяць</span></div>
          </div>
        )}

        {/* ── Легенда ── */}
        {!isMobile && (
          <div className="cal-legend">
            {[
              { label: 'Пожежний наряд', bg: '#ef4444' }, { label: 'КПП / Пропускний', bg: '#f97316' },
              { label: 'Курсу / Підрозділ', bg: '#16a34a' }, { label: 'Навч. корпус', bg: '#0891b2' },
              { label: 'Штаб', bg: '#7c3aed' }, { label: 'Гуртожиток', bg: '#ca8a04' },
              { label: 'Парк', bg: '#0d9488' }, { label: 'Інше', bg: '#3b82f6' },
            ].map(item => (
              <div key={item.label} className="cal-legend-item">
                <div className="cal-legend-dot" style={{ background: item.bg }} />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {/* ── Календар / мобільний вигляд ── */}
        {isLoading ? (
          <div className="cal-loading-sk">
            <div className="cal-sk-toolbar">
              <div className="sk-bone" style={{ width: 120, height: 32, borderRadius: 8 }} />
              <div className="sk-bone" style={{ width: 180, height: 28, borderRadius: 8 }} />
              <div className="sk-bone" style={{ width: 120, height: 32, borderRadius: 8 }} />
            </div>
            <div className="cal-sk-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="cal-sk-cell">
                  {i < 7 && <div className="sk-bone" style={{ width: '60%', height: 12, borderRadius: 4, marginBottom: 4 }} />}
                  {Math.random() > 0.7 && <div className="sk-bone" style={{ width: '90%', height: 18, borderRadius: 4, marginBottom: 2 }} />}
                  {Math.random() > 0.8 && <div className="sk-bone" style={{ width: '80%', height: 18, borderRadius: 4 }} />}
                </div>
              ))}
            </div>
          </div>
        ) : isMobile ? (
          <MobileScheduleView events={events} currentMonth={calDate} onMonthChange={setCalDate} onEventClick={handleEventClick} />
        ) : (
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer} events={events}
              startAccessor="start" endAccessor="end"
              eventPropGetter={eventStyleGetter}
              components={calComponents}
              popup={false} onShowMore={handleShowMore}
              onSelectEvent={handleEventClick} onDrillDown={() => {}}
              selectable onSelectSlot={handleSelectSlot}
              date={calDate} view={view} onNavigate={setCalDate} onView={setView}
              messages={{ next: 'Наст.', previous: 'Попер.', today: 'Сьогодні', month: 'Місяць', week: 'Тиждень', day: 'День', agenda: 'Список', noEventsInRange: 'Нарядів немає.' }}
            />
          </div>
        )}

        {/* ── Тултіп при наведенні на подію ── */}
        {tooltip && createPortal(
          <div
            className="cal-tooltip-popup"
            style={{ top: tooltip.y - 8, left: tooltip.x, transform: 'translate(-50%, -100%)' }}
          >
            <div className="cal-tt-type" style={{ color: getDutyColor(tooltip.event.dutyTypeName).bg }}>
              {tooltip.event.dutyTypeName}
            </div>
            <div className="cal-tt-soldier">👤 {tooltip.event.soldierName}</div>
            <div className="cal-tt-date">
              {tooltip.event.start.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'long' })}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* ══ МОДАЛКА: РУЧНА ЗАМІНА ══ */}
      <Modal show={showSwapModal} onHide={() => setShowSwapModal(false)} centered>
        <Modal.Header closeButton style={{ background: '#f59e0b', borderBottom: 'none' }}>
          <Modal.Title style={{ fontSize: '1rem', fontWeight: 700 }}>🔄 Ручна заміна в наряді</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.25rem' }}>
          {swapDate && (
            <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--bs-secondary-color)' }}>
              📅 Дата: <strong style={{ color: 'var(--bs-body-color)' }}>
                {swapDate.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
              </strong>
            </div>
          )}
          <div className="swap-step">
            <div className="swap-step-label">1. Оберіть пост для заміни</div>
            {(() => {
              const evOnDate  = events.filter(e => swapDate && e.start.toDateString() === swapDate.toDateString());
              const dutiesMap = new Map<number, string>();
              evOnDate.forEach(e => dutiesMap.set(e.dutyTypeId, e.dutyTypeName));
              const duties = Array.from(dutiesMap, ([id, name]) => ({ id, name }));
              return (
                <Form.Select value={selectedDutyTypeId} onChange={e => { setSelectedDutyTypeId(e.target.value); setTargetScheduleId(null); }} style={{ borderRadius: '10px', fontSize: '0.85rem' }}>
                  <option value="">-- Оберіть пост --</option>
                  {duties.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Form.Select>
              );
            })()}
          </div>
          {selectedDutyTypeId && (() => {
            const people = events.filter(e => swapDate && e.start.toDateString() === swapDate.toDateString() && e.dutyTypeId?.toString() === selectedDutyTypeId);
            if (people.length === 0) return null;
            return (
              <div className="swap-step">
                <div className="swap-step-label">2. Кого знімаємо з наряду?</div>
                {people.map(p => (
                  <div key={p.id} className={`swap-radio-item${targetScheduleId === p.id ? ' selected' : ''}`} onClick={() => setTargetScheduleId(p.id)}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${targetScheduleId === p.id ? '#3b82f6' : 'var(--bs-border-color)'}`, background: targetScheduleId === p.id ? '#3b82f6' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {targetScheduleId === p.id && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: '0.88rem' }}>{p.soldierName}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="swap-step">
            <div className="swap-step-label">3. Ким замінити?</div>
            <Form.Select value={newSoldierId} onChange={e => setNewSoldierId(e.target.value)} disabled={!targetScheduleId} style={{ borderRadius: '10px', fontSize: '0.85rem' }}>
              <option value="">-- Виберіть зі списку --</option>
              {soldiersList.map(s => <option key={s.id} value={s.id}>{s.rank} {s.name}</option>)}
            </Form.Select>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid var(--bs-border-color)', gap: '8px' }}>
          <Button variant="outline-secondary" onClick={() => setShowSwapModal(false)} style={{ borderRadius: '10px' }}>Скасувати</Button>
          <Button onClick={handleSwapSubmit} disabled={!targetScheduleId || !newSoldierId} style={{ borderRadius: '10px', background: '#16a34a', border: 'none' }}>🔄 Виконати заміну</Button>
        </Modal.Footer>
      </Modal>

      {/* ══ МОДАЛКА: ДОБОВА ВІДОМІСТЬ ══ */}
      <Modal show={showDailyModal} onHide={() => setShowDailyModal(false)} size="lg" centered>
        <Modal.Header closeButton style={{ background: '#1e3a5f', borderBottom: 'none' }}>
          <Modal.Title style={{ color: '#fff', fontSize: '1rem', fontWeight: 700 }}>
            📋 Добова відомість —{' '}
            {dailyDate?.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '1.25rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {Object.keys(groupedDaily).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--bs-secondary-color)', padding: '2rem' }}>Нарядів не знайдено</div>
          ) : (
            Object.entries(groupedDaily).map(([dutyType, soldiers]) => {
              const { bg, text } = getDutyColor(dutyType);
              return (
                <div key={dutyType} className="daily-duty-group">
                  <div className="daily-duty-header" style={{ background: bg, color: text }}>
                    <span>{dutyType}</span>
                    <Badge bg="light" text="dark" style={{ fontSize: '0.7rem' }}>{soldiers.length} ос.</Badge>
                  </div>
                  <div className="daily-duty-body">
                    {soldiers.map((s, i) => (
                      <div key={i} className="daily-soldier-row">
                        <span style={{ color: 'var(--bs-secondary-color)', fontSize: '0.8rem', minWidth: '20px' }}>{i + 1}.</span>
                        {s.soldierName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid var(--bs-border-color)' }}>
          <Button variant="outline-secondary" onClick={() => setShowDailyModal(false)} style={{ borderRadius: '10px' }}>Закрити</Button>
          {isCommander && (
            <Button style={{ borderRadius: '10px', background: '#7c3aed', border: 'none' }} onClick={() => { setShowDailyModal(false); if (dailyDate && dailyEvents.length > 0) handleEventClick(dailyEvents[0]); }}>
              ✏️ Редагувати наряди
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};