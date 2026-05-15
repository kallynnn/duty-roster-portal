import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MILITARY_RANKS, MILITARY_POSITIONS, STARSHYNA_POSITIONS, COMMANDER_POSITIONS } from '../utils/constants';

interface FormData {
  name: string; rank: string; position: string;
  phoneNumber: string; email: string;
  password: string; passwordConfirmation: string;
}

const INITIAL: FormData = {
  name: '', rank: '', position: '', phoneNumber: '',
  email: '', password: '', passwordConfirmation: '',
};

const STEPS = [
  { label: 'Особисті дані',   icon: '👤' },
  { label: 'Служба',          icon: '🛡️' },
  { label: 'Обліковий запис', icon: '🔐' },
];

const getRoleLabel = (position: string): { label: string; color: string } | null => {
  if (STARSHYNA_POSITIONS.includes(position)) return { label: 'Старшина', color: '#7c3aed' };
  if (COMMANDER_POSITIONS.includes(position)) return { label: 'Командир', color: '#1e3a5f' };
  return null;
};

const Field: React.FC<{ label: string; icon: string; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="auth-field">
    <label className="auth-label">{label}</label>
    <div className="auth-input-wrap">
      <span className="auth-input-icon">{icon}</span>
      {children}
    </div>
  </div>
);

export const RegisterPage: React.FC = () => {
  const [form,      setForm]      = useState<FormData>(INITIAL);
  const [step,      setStep]      = useState(0);
  const [showPass,  setShowPass]  = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setError('');
    };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.name.trim()) { setError('Введіть ПІБ'); return false; }
      if (form.name.trim().split(' ').length < 2) { setError("Введіть повне ПІБ (мінімум прізвище та ім'я)"); return false; }
      if (!form.phoneNumber.trim()) { setError('Введіть номер телефону'); return false; }
      if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phoneNumber)) { setError('Невірний формат телефону'); return false; }
    }
    if (step === 1) {
      if (!form.rank)     { setError('Оберіть звання'); return false; }
      if (!form.position) { setError('Оберіть посаду'); return false; }
    }
    if (step === 2) {
      if (!form.email.trim())    { setError('Введіть email'); return false; }
      if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Невірний формат email'); return false; }
      if (form.password.length < 6) { setError('Пароль мінімум 6 символів'); return false; }
      if (form.password !== form.passwordConfirmation) { setError('Паролі не збігаються'); return false; }
    }
    return true;
  };

  const handleNext = () => { if (!validateStep()) return; setError(''); setStep(s => s + 1); };
  const handleBack = () => { setError(''); setStep(s => s - 1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true); setError('');
    try {
      await axios.post('/api/auth/register', {
        name: form.name.trim(), rank: form.rank, position: form.position,
        phoneNumber: form.phoneNumber.trim(), email: form.email.trim(),
        password: form.password, passwordConfirmation: form.passwordConfirmation,
      });
      setStep(3);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(axios.isAxiosError(err) && err.response
        ? err.response.data.message || 'Помилка реєстрації'
        : 'Щось пішло не так');
    } finally { setLoading(false); }
  };

  if (step === 3) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-success">
            <div className="auth-success-icon">✅</div>
            <h2 className="auth-success-title">Реєстрацію завершено!</h2>
            <p className="auth-success-sub">Акаунт створено. Перенаправлення на сторінку входу...</p>
            <div className="auth-success-bar"><div className="auth-success-bar-fill" /></div>
          </div>
        </div>
      </div>
    );
  }

  const roleInfo = form.position ? getRoleLabel(form.position) : null;

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">

        <div className="auth-logo">
          <div className="auth-logo-icon">🛡️</div>
          <h1 className="auth-title">Реєстрація</h1>
          <p className="auth-subtitle">DutyPortal · ВІТІ</p>
        </div>

        <div className="reg-stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`reg-step${i < step ? ' done' : i === step ? ' active' : ''}`}>
                <div className="reg-step-circle">{i < step ? '✓' : s.icon}</div>
                <span className="reg-step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`reg-step-line${i < step ? ' done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Крок 0 */}
        {step === 0 && (
          <div className="reg-step-content">
            <Field label="ПІБ (Прізвище Ім'я По-батькові)" icon="👤">
              <input className="auth-input" type="text" placeholder="напр. Новіков Микола Михайлович"
                value={form.name} onChange={set('name')} autoFocus />
            </Field>
            <Field label="Номер телефону" icon="📱">
              <input className="auth-input" type="tel" placeholder="+380XXXXXXXXX"
                value={form.phoneNumber} onChange={set('phoneNumber')} />
            </Field>
          </div>
        )}

        {/* Крок 1 */}
        {step === 1 && (
          <div className="reg-step-content">
            <Field label="Військове звання" icon="🎖️">
              <select className="auth-input auth-select" value={form.rank} onChange={set('rank')}>
                <option value="" disabled>Оберіть звання...</option>
                {MILITARY_RANKS.map((r, i) => <option key={i} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Посада" icon="🏢">
              <select className="auth-input auth-select" value={form.position} onChange={set('position')}>
                <option value="" disabled>Оберіть посаду...</option>
                {MILITARY_POSITIONS.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </Field>

            {(form.rank || form.position) && (
              <div className="reg-preview">
                <div className="reg-preview-title">Ваш профіль:</div>
                {form.rank && (
                  <div className="reg-preview-row">
                    <span className="reg-preview-label">Звання:</span>
                    <span className="reg-preview-value">{form.rank}</span>
                  </div>
                )}
                {form.position && (
                  <div className="reg-preview-row">
                    <span className="reg-preview-label">Посада:</span>
                    <span className="reg-preview-value">{form.position}</span>
                  </div>
                )}
                {/* Показуємо роль яку отримає користувач */}
                {roleInfo && (
                  <div className="reg-preview-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--bs-border-color)' }}>
                    <span className="reg-preview-label">Роль в системі:</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: `${roleInfo.color}18`, color: roleInfo.color, border: `1px solid ${roleInfo.color}40` }}>
                      {roleInfo.label}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Крок 2 */}
        {step === 2 && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="reg-step-content">
              <Field label="Email адреса" icon="✉️">
                <input className="auth-input" type="email" placeholder="your@viti.edu.ua"
                  value={form.email} onChange={set('email')} autoComplete="email" autoFocus />
              </Field>
              <Field label="Пароль (мін. 6 символів)" icon="🔒">
                <input className="auth-input" type={showPass ? 'text' : 'password'}
                  placeholder="Придумайте пароль" value={form.password} onChange={set('password')} autoComplete="new-password" />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </Field>
              {form.password && (
                <div className="pass-strength">
                  {[1,2,3,4].map(i => {
                    const s = (form.password.length>=6?1:0)+(/[A-Z]/.test(form.password)?1:0)+(/[0-9]/.test(form.password)?1:0)+(/[^A-Za-z0-9]/.test(form.password)?1:0);
                    return <div key={i} className="pass-strength-bar" style={{ background: i<=s ? ['#ef4444','#f97316','#eab308','#22c55e'][s-1] : '#e5e7eb' }} />;
                  })}
                  <span className="pass-strength-label">
                    {(() => { const s=(form.password.length>=6?1:0)+(/[A-Z]/.test(form.password)?1:0)+(/[0-9]/.test(form.password)?1:0)+(/[^A-Za-z0-9]/.test(form.password)?1:0); return ['','Слабкий','Помірний','Хороший','Надійний'][s]; })()}
                  </span>
                </div>
              )}
              <Field label="Повторіть пароль" icon="🔒">
                <input className={`auth-input${form.passwordConfirmation && form.password !== form.passwordConfirmation ? ' auth-input-error' : ''}`}
                  type={showPass2 ? 'text' : 'password'} placeholder="Повторіть пароль"
                  value={form.passwordConfirmation} onChange={set('passwordConfirmation')} autoComplete="new-password" />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass2(p => !p)} tabIndex={-1}>
                  {showPass2 ? '🙈' : '👁️'}
                </button>
              </Field>
              {form.passwordConfirmation && form.password !== form.passwordConfirmation && <div className="auth-field-hint error">Паролі не збігаються</div>}
              {form.passwordConfirmation && form.password === form.passwordConfirmation && <div className="auth-field-hint success">✓ Паролі збігаються</div>}
            </div>
            {error && <div className="auth-error"><span>⚠️</span> {error}</div>}
            <div className="reg-actions">
              <button type="button" className="auth-back-btn" onClick={handleBack}>← Назад</button>
              <button type="submit" className="auth-submit-btn reg-submit" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : 'Зареєструватися'}
              </button>
            </div>
          </form>
        )}

        {step < 2 && error && <div className="auth-error"><span>⚠️</span> {error}</div>}
        {step < 2 && (
          <div className="reg-actions">
            {step > 0 && <button type="button" className="auth-back-btn" onClick={handleBack}>← Назад</button>}
            <button type="button" className={`auth-submit-btn${step === 0 ? ' full-width' : ''}`} onClick={handleNext}>Далі →</button>
          </div>
        )}

        <div className="auth-footer">
          Вже є акаунт? <Link to="/login" className="auth-link">Увійти</Link>
        </div>
      </div>
    </div>
  );
};