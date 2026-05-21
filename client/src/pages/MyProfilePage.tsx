import React, { useState, useEffect } from 'react';
import { Container, Alert, Modal, Form, Button, Spinner, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { Sk } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';

interface ScheduleItem {
  id: number; date: string;
  dutyType: { name: string };
  soldier?: { name: string; rank: string };
}
interface SoldierProfile {
  name: string; rank: string; position: string; status: string;
  platoon?: string; squad?: string; company?: string;
  phoneNumber?: string; birthDate?: string;
}
interface ProfileData {
  soldier: SoldierProfile; schedules: ScheduleItem[];
  isCommander: boolean; commandLevel: string; subordinatesSchedules: ScheduleItem[];
}
interface ActiveSoldier { id: number; name: string; rank: string; position: string; }
interface SwapRequest {
  id: number; status: string; createdAt: string;
  schedule: { id?: number; date: string; dutyType: { name: string } };
  requester: { name: string; rank: string };
  targetSoldier: { name: string; rank: string };
}

const getDaysDiff = (d: string) => { const t = new Date(); t.setHours(0,0,0,0); const s = new Date(d); s.setHours(0,0,0,0); return Math.round((s.getTime()-t.getTime())/86400000); };
const formatDate  = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day:'2-digit', month:'long', weekday:'short' });
const formatShort = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit' });
const formatBirth = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day:'2-digit', month:'long', year:'numeric' });
const getInitials = (n: string) => n.split(' ').map(w=>w[0]).slice(0,2).join('');

const STATUS_COLOR: Record<string,string> = { ACTIVE:'#22c55e', LEAVE:'#f59e0b', SICK:'#ef4444' };
const STATUS_LABEL: Record<string,string> = { ACTIVE:'В строю', LEAVE:'Відпустка', SICK:'Хворий' };
const SWAP_ST: Record<string,{label:string;color:string}> = {
  PENDING:  { label:'Очікує',   color:'#f59e0b' },
  APPROVED: { label:'Схвалено', color:'#22c55e' },
  REJECTED: { label:'Відхилено',color:'#ef4444' },
};

const ProfileSkeleton: React.FC = () => (
  <div className="profile-page">
    <div className="sk-hero">
      <Sk w={60} h={60} r="50%" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Sk h="1.1rem" r="8px" style={{ marginBottom: 8 }} />
        <Sk w="55%" h="0.8rem" r="8px" style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Sk w={80} h={22} r="20px" />
          <Sk w={100} h={22} r="20px" />
        </div>
      </div>
    </div>
    <div className="sk-card" style={{ marginBottom: '1rem' }}>
      <Sk h="1.4rem" style={{ marginBottom: 8 }} />
      <Sk w="45%" h="0.85rem" />
    </div>
    <div className="sk-stats-grid">
      {[0,1,2].map(i => (
        <div key={i} className="sk-card">
          <Sk w={40} h="1.6rem" r="8px" style={{ margin: '0 auto 6px' }} />
          <Sk w={60} h="0.7rem" r="6px" style={{ margin: '0 auto' }} />
        </div>
      ))}
    </div>
    {[0,1,2,3,4].map(i => (
      <div key={i} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'center' }}>
        <Sk w={20} h={12} r="50%" style={{ flexShrink: 0 }} />
        <div className="sk-card" style={{ flex:1, padding:'10px 14px', marginBottom:0 }}>
          <Sk w="40%" h="0.72rem" style={{ marginBottom: 6 }} />
          <Sk w="65%" h="0.9rem" />
        </div>
      </div>
    ))}
  </div>
);

export const MyProfilePage: React.FC = () => {
  const { login, role } = useAuth();
  const [profileData,    setProfileData]    = useState<ProfileData|null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [swapModal,      setSwapModal]      = useState(false);
  const [swapSchedule,   setSwapSchedule]   = useState<ScheduleItem|null>(null);
  const [activeSoldiers, setActiveSoldiers] = useState<ActiveSoldier[]>([]);
  const [targetId,       setTargetId]       = useState('');
  const [swapLoading,    setSwapLoading]    = useState(false);
  const [swapError,      setSwapError]      = useState('');
  const [swapSent,       setSwapSent]       = useState<number[]>([]);
  const [swapRequests,   setSwapRequests]   = useState<SwapRequest[]>([]);

  // ── Редагування профілю ──
  const [editModal,    setEditModal]    = useState(false);
  const [editEmail,    setEditEmail]    = useState('');
  const [editPhone,    setEditPhone]    = useState('');
  const [editBirth,    setEditBirth]    = useState('');
  const [editLoading,  setEditLoading]  = useState(false);
  const [editError,    setEditError]    = useState('');
  const [editSuccess,  setEditSuccess]  = useState(false);
  const [userEmail,    setUserEmail]    = useState('');

  const loadSwapRequests = async () => {
    try {
      const r = await axios.get('/api/swap-requests');
      setSwapRequests(r.data);
      setSwapSent(r.data.filter((x:SwapRequest)=>x.status==='PENDING').map((x:SwapRequest)=>x.schedule?.id).filter(Boolean));
    } catch { /* тихо */ }
  };

  useEffect(() => {
    Promise.all([
      axios.get('/api/schedule/my'),
      axios.get('/api/auth/me'),
    ]).then(([profileRes, meRes]) => {
      setProfileData(profileRes.data);
      setUserEmail(meRes.data.email || '');
    }).catch(e => setError(e.response?.data?.message || 'Помилка завантаження'))
      .finally(() => setLoading(false));
    loadSwapRequests();
  }, []);

  const openSwapModal = async (item: ScheduleItem) => {
    setSwapSchedule(item); setTargetId(''); setSwapError(''); setSwapModal(true);
    try { const r = await axios.get('/api/soldiers/all-active'); setActiveSoldiers(r.data); }
    catch { setSwapError('Не вдалося завантажити список солдат'); }
  };

  const handleSwapSubmit = async () => {
    if (!targetId) { setSwapError('Оберіть замінника'); return; }
    if (!swapSchedule) return;
    setSwapLoading(true); setSwapError('');
    try {
      await axios.post('/api/swap-requests', { scheduleId: swapSchedule.id, targetSoldierId: Number(targetId) });
      setSwapSent(prev => [...prev, swapSchedule.id]);
      setSwapModal(false); await loadSwapRequests();
    } catch (e:any) { setSwapError(e.response?.data?.message || 'Помилка надсилання'); }
    finally { setSwapLoading(false); }
  };

  const handleAction = async (id: number, action: 'approve'|'reject') => {
    try { await axios.patch(`/api/swap-requests/${id}`, { action }); await loadSwapRequests(); }
    catch (e:any) { alert(e.response?.data?.message || 'Помилка'); }
  };

  const openEditModal = () => {
    if (!profileData) return;
    setEditEmail(userEmail);
    setEditPhone(profileData.soldier.phoneNumber || '');
    setEditBirth(
      profileData.soldier.birthDate
        ? new Date(profileData.soldier.birthDate).toISOString().slice(0, 10)
        : ''
    );
    setEditError(''); setEditSuccess(false);
    setEditModal(true);
  };

  const handleEditSave = async () => {
    setEditLoading(true); setEditError(''); setEditSuccess(false);
    try {
      const { data } = await axios.patch('/api/profile/me', {
        email:       editEmail.trim() || undefined,
        phoneNumber: editPhone,
        birthDate:   editBirth || null,
      });
      // Оновлюємо локальний стан
      setUserEmail(data.user.email);
      setProfileData(prev => prev ? {
        ...prev,
        soldier: {
          ...prev.soldier,
          phoneNumber: data.user.soldier?.phoneNumber,
          birthDate:   data.user.soldier?.birthDate,
        }
      } : prev);
      // Якщо email змінився — оновлюємо в localStorage (без зміни токена)
      if (data.user.email !== userEmail) {
        login(localStorage.getItem('auth-token') || '', role || '', false);
      }
      setEditSuccess(true);
    } catch (e: any) {
      setEditError(e.response?.data?.message || 'Помилка збереження');
    } finally { setEditLoading(false); }
  };

  if (loading) return <ProfileSkeleton />;
  if (error)   return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;
  if (!profileData) return null;

  const { soldier, schedules, isCommander, commandLevel, subordinatesSchedules } = profileData;

  // Timeline data
  const pastDuties   = schedules.filter(s => getDaysDiff(s.date) < 0)
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-5);
  const todayItems   = schedules.filter(s => getDaysDiff(s.date) === 0);
  const futureDuties = schedules.filter(s => getDaysDiff(s.date) > 0);
  const upcoming     = schedules.filter(s => getDaysDiff(s.date) >= 0);
  const nextDuty     = upcoming[0] ?? null;
  const nextDiff     = nextDuty ? getDaysDiff(nextDuty.date) : null;

  // Profile stats (local, past-looking)
  const todayCount   = todayItems.length;
  const weekCount    = schedules.filter(s => { const d=getDaysDiff(s.date); return d>=-6&&d<=0; }).length;
  const monthCount   = schedules.filter(s => { const d=getDaysDiff(s.date); return d>=-29&&d<=0; }).length;

  const pendingReqs = swapRequests.filter(r => r.status==='PENDING');
  const myReqs      = swapRequests.slice(0,5);

  const hasTimeline = pastDuties.length > 0 || todayItems.length > 0 || futureDuties.length > 0;

  return (
    <>
      {/* ══ МОДАЛКА: РЕДАГУВАННЯ ПРОФІЛЮ ══ */}
      <Modal show={editModal} onHide={() => setEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{fontSize:'1rem',fontWeight:700}}>✏️ Редагування профілю</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'1.5rem'}}>

          <Row className="g-3">
            <Col xs={12}>
              <Form.Label className="profile-edit-label">✉️ Email</Form.Label>
              <Form.Control
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                placeholder="your@viti.edu.ua"
                className="profile-edit-input"
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="profile-edit-label">📞 Номер телефону</Form.Label>
              <Form.Control
                type="tel"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="+380XXXXXXXXX"
                className="profile-edit-input"
              />
            </Col>
            <Col xs={12}>
              <Form.Label className="profile-edit-label">🎂 Дата народження</Form.Label>
              <Form.Control
                type="date"
                value={editBirth}
                onChange={e => setEditBirth(e.target.value)}
                className="profile-edit-input"
                max={new Date().toISOString().slice(0,10)}
              />
            </Col>
          </Row>

          {editError   && <div className="profile-edit-error mt-3">⚠️ {editError}</div>}
          {editSuccess && <div className="profile-edit-success mt-3">✓ Профіль оновлено успішно!</div>}
        </Modal.Body>
        <Modal.Footer style={{gap:8}}>
          <Button variant="outline-secondary" onClick={() => setEditModal(false)}>Скасувати</Button>
          <Button
            onClick={handleEditSave}
            disabled={editLoading}
            style={{background:'#3b82f6',border:'none',borderRadius:'10px',fontWeight:600}}
          >
            {editLoading ? <Spinner animation="border" size="sm"/> : 'Зберегти'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ══ МОДАЛКА: ЗАПИТ НА ЗАМІНУ ══ */}
      <Modal show={swapModal} onHide={()=>setSwapModal(false)} centered>
        <Modal.Header closeButton style={{background:'#1e3a5f',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontSize:'1rem',fontWeight:700}}>🔄 Запит на заміну</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'1.25rem'}}>
          {swapSchedule && (
            <div style={{marginBottom:'1rem',padding:'10px 14px',background:'var(--bs-tertiary-bg)',borderRadius:'10px'}}>
              <div style={{fontSize:'0.75rem',color:'var(--bs-secondary-color)',marginBottom:'2px'}}>Наряд</div>
              <div style={{fontWeight:600}}>{swapSchedule.dutyType.name}</div>
              <div style={{fontSize:'0.82rem',color:'var(--bs-secondary-color)'}}>{formatDate(swapSchedule.date)}</div>
            </div>
          )}
          <div style={{marginBottom:'6px',fontSize:'0.78rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--bs-secondary-color)'}}>
            Оберіть замінника
          </div>
          <Form.Select value={targetId} onChange={e=>setTargetId(e.target.value)} style={{borderRadius:'10px',fontSize:'0.88rem'}}>
            <option value="">-- Виберіть зі списку --</option>
            {activeSoldiers.map(s => <option key={s.id} value={s.id}>{s.rank} {s.name}</option>)}
          </Form.Select>
          {swapError && <div style={{marginTop:'10px',padding:'8px 12px',background:'rgba(239,68,68,0.1)',borderRadius:'8px',fontSize:'0.82rem',color:'#ef4444'}}>⚠️ {swapError}</div>}
        </Modal.Body>
        <Modal.Footer style={{borderTop:'1px solid var(--bs-border-color)',gap:'8px'}}>
          <Button variant="outline-secondary" onClick={()=>setSwapModal(false)} style={{borderRadius:'10px'}}>Скасувати</Button>
          <Button onClick={handleSwapSubmit} disabled={swapLoading||!targetId} style={{borderRadius:'10px',background:'#1e3a5f',border:'none'}}>
            {swapLoading ? <Spinner animation="border" size="sm"/> : '📨 Надіслати запит'}
          </Button>
        </Modal.Footer>
      </Modal>

      <div className="profile-page">

        {/* Hero */}
        <div className="hero-card">
          <div className="hero-avatar">{getInitials(soldier.name)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
              <p className="hero-name" style={{margin:0}}>{soldier.name}</p>
              <button className="profile-edit-btn" onClick={openEditModal} title="Редагувати профіль">✏️</button>
            </div>
            <p className="hero-sub">{soldier.rank} · {soldier.position}</p>
            <div className="hero-badges">
              {soldier.company && <span className="hero-badge">🏢 {soldier.company}</span>}
              {soldier.platoon && <span className="hero-badge">🔹 Взвод {soldier.platoon}</span>}
              {soldier.squad   && <span className="hero-badge">👥 Відділення {soldier.squad}</span>}
              <span className="hero-badge">
                <span className="hero-status-dot" style={{background:STATUS_COLOR[soldier.status]??'#22c55e'}}/>
                {STATUS_LABEL[soldier.status]??soldier.status}
              </span>
            </div>
            {/* Контактні дані */}
            <div className="hero-contacts">
              {userEmail && (
                <span className="hero-contact-item">✉️ {userEmail}</span>
              )}
              {soldier.phoneNumber && soldier.phoneNumber !== 'Не вказано' && (
                <span className="hero-contact-item">📞 {soldier.phoneNumber}</span>
              )}
              {soldier.birthDate && (
                <span className="hero-contact-item">🎂 {formatBirth(soldier.birthDate)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Наступне чергування */}
        {nextDuty ? (
          <div className={`next-duty-banner ${nextDiff===0?'today-banner':nextDiff!<=3?'soon-banner':'rest-banner'}`}>
            <div className="ndb-label">Наступне чергування</div>
            <div className="ndb-date">{formatDate(nextDuty.date)}</div>
            <div className="ndb-type">{nextDuty.dutyType.name}</div>
            <span className={`ndb-pill ${nextDiff===0?'today':nextDiff!<=3?'soon':'rest'}`}>
              {nextDiff===0?'СЬОГОДНІ':nextDiff===1?'ЗАВТРА':`через ${nextDiff} дн.`}
            </span>
          </div>
        ) : (
          <div className="next-duty-banner rest-banner">
            <div className="ndb-label">Наступне чергування</div>
            <div className="ndb-date">Не заплановано</div>
            <div className="ndb-type">Насолоджуйтесь відпочинком ☕</div>
          </div>
        )}

        {/* Статистика */}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-num">{todayCount}</div><div className="stat-lbl">Сьогодні</div></div>
          <div className="stat-card"><div className="stat-num">{weekCount}</div><div className="stat-lbl">За тиждень</div></div>
          <div className="stat-card"><div className="stat-num">{monthCount}</div><div className="stat-lbl">За місяць</div></div>
        </div>

        {/* ── ТАЙМЛАЙН нарядів ── */}
        <div className="section-title">Хронологія нарядів</div>
        {!hasTimeline ? (
          <div className="empty-state"><div className="empty-state-icon">☕</div>Нарядів поки немає. Відпочивайте!</div>
        ) : (
          <div className="duty-timeline">

            {/* Минулі */}
            {pastDuties.length > 0 && (
              <>
                <div className="tl-section-label">Минулі</div>
                {pastDuties.map((item, idx) => {
                  const isLast = idx === pastDuties.length - 1 && todayItems.length === 0 && futureDuties.length === 0;
                  return (
                    <div key={item.id} className="tl-item">
                      <div className="tl-stem">
                        <div className="tl-dot past" />
                        {!isLast && <div className="tl-line" />}
                      </div>
                      <div className="tl-body past">
                        <div>
                          <div className="tl-date">{formatDate(item.date)}</div>
                          <div className="tl-name">{item.dutyType.name}</div>
                        </div>
                        <span className="tl-pill past">виконано</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Сьогодні */}
            {todayItems.length > 0 && (
              <>
                <div className="tl-section-label">Сьогодні</div>
                {todayItems.map((item, idx) => {
                  const isLast = idx === todayItems.length - 1 && futureDuties.length === 0;
                  return (
                    <div key={item.id} className="tl-item">
                      <div className="tl-stem">
                        <div className="tl-dot today" />
                        {!isLast && <div className="tl-line" />}
                      </div>
                      <div className="tl-body today">
                        <div>
                          <div className="tl-date">{formatDate(item.date)}</div>
                          <div className="tl-name">{item.dutyType.name}</div>
                        </div>
                        <span className="tl-pill today">СЬОГОДНІ</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Майбутні */}
            {futureDuties.length > 0 && (
              <>
                <div className="tl-section-label">Майбутні</div>
                {futureDuties.map((item, idx) => {
                  const diff = getDaysDiff(item.date);
                  const sent = swapSent.includes(item.id);
                  const isLast = idx === futureDuties.length - 1;
                  return (
                    <div key={item.id} className="tl-item">
                      <div className="tl-stem">
                        <div className="tl-dot future" />
                        {!isLast && <div className="tl-line" />}
                      </div>
                      <div className="tl-body future">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="tl-date">{formatDate(item.date)}</div>
                          <div className="tl-name">{item.dutyType.name}</div>
                        </div>
                        <div className="tl-badge">
                          <span className={`tl-pill ${diff <= 3 ? 'soon' : 'later'}`}>
                            {diff === 1 ? 'завтра' : `через ${diff} дн.`}
                          </span>
                          <button
                            className={`swap-btn ${sent ? 'sent' : ''}`}
                            disabled={sent}
                            onClick={() => openSwapModal(item)}
                          >
                            {sent ? '✓ Надіслано' : '🔄 Замінитись'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

          </div>
        )}

        {/* Мої запити (курсант) */}
        {!isCommander && myReqs.length > 0 && (
          <>
            <div className="section-title">Мої запити на заміну</div>
            <div className="commander-panel">
              {myReqs.map(req => {
                const st = SWAP_ST[req.status] ?? { label:req.status, color:'#9ca3af' };
                return (
                  <div key={req.id} className="sub-card">
                    <div style={{flex:1,minWidth:0}}>
                      <div className="sub-name">{req.schedule?.dutyType?.name}</div>
                      <div className="sub-rank">{req.schedule?.date?formatShort(req.schedule.date):''} · Замінник: {req.targetSoldier?.name}</div>
                    </div>
                    <span style={{fontSize:'0.72rem',fontWeight:600,padding:'3px 10px',borderRadius:'20px',background:`${st.color}20`,color:st.color,whiteSpace:'nowrap'}}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Запити для командира */}
        {isCommander && pendingReqs.length > 0 && (
          <>
            <div className="section-title">
              Запити на заміну
              <span style={{marginLeft:'8px',fontSize:'0.7rem',padding:'2px 8px',borderRadius:'20px',background:'#ef4444',color:'#fff',fontWeight:600}}>{pendingReqs.length}</span>
            </div>
            <div className="commander-panel" style={{marginBottom:'1rem'}}>
              <div className="commander-header">
                <span style={{fontSize:'1.1rem'}}>🔄</span>
                <div><h5>Запити на заміну від особового складу</h5></div>
              </div>
              {pendingReqs.map(req => (
                <div key={req.id} className="sub-card" style={{flexWrap:'wrap',gap:'10px'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="sub-name">{req.requester?.name} → {req.targetSoldier?.name}</div>
                    <div className="sub-rank">{req.schedule?.dutyType?.name}{req.schedule?.date?` · ${formatShort(req.schedule.date)}`:''}</div>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    <button onClick={()=>handleAction(req.id,'approve')} style={{fontSize:'0.75rem',padding:'5px 12px',borderRadius:'8px',border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:600}}>✓ Схвалити</button>
                    <button onClick={()=>handleAction(req.id,'reject')} style={{fontSize:'0.75rem',padding:'5px 12px',borderRadius:'8px',border:'1.5px solid #ef4444',background:'transparent',color:'#ef4444',cursor:'pointer',fontWeight:600}}>✕ Відхилити</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Командирська панель */}
        {isCommander && (
          <>
            <div className="section-title">Командирська панель — {commandLevel}</div>
            <div className="commander-panel">
              <div className="commander-header">
                <span style={{fontSize:'1.1rem'}}>🛡️</span>
                <div><h5>Графік підлеглого особового складу</h5><span>{subordinatesSchedules.length} майбутніх нарядів</span></div>
              </div>
              {subordinatesSchedules.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">✅</div>Підлеглі найближчим часом у наряд не заступають</div>
              ) : subordinatesSchedules.map(item => {
                const isToday=getDaysDiff(item.date)===0;
                return (
                  <div key={item.id} className="sub-card">
                    <div className="sub-avatar">{getInitials(item.soldier?.name??'?')}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="sub-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.soldier?.name}</div>
                      <div className="sub-rank">{item.soldier?.rank} · {item.dutyType.name}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      {isToday?<span className="sub-today-badge">Сьогодні</span>:<div className="sub-date">{formatShort(item.date)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </>
  );
};
