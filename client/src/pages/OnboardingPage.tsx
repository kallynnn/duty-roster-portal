import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Посади → чи потребує коду
const POSITIONS = [
  { label: 'Курсант',              value: 'Курсант',              needsCode: false },
  { label: 'Командир відділення',  value: 'Командир відділення',  needsCode: false },
  { label: 'Командир групи',       value: 'Командир групи',       needsCode: false },
  { label: 'Старшина курсу',       value: 'Старшина курсу',       needsCode: true  },
  { label: 'Начальник курсу',      value: 'Начальник курсу',      needsCode: true  },
  { label: 'Начальник факультету', value: 'Начальник факультету', needsCode: true  },
];

export const OnboardingPage: React.FC = () => {
  const { completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [position,   setPosition]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showCode,   setShowCode]   = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const selectedPos = POSITIONS.find(p => p.value === position);
  const needsCode   = selectedPos?.needsCode ?? false;

  const handlePositionChange = (val: string) => {
    setPosition(val);
    setInviteCode('');
    setError('');
    const pos = POSITIONS.find(p => p.value === val);
    setShowCode(pos?.needsCode ?? false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) { setError('Оберіть посаду'); return; }
    if (needsCode && !inviteCode.trim()) { setError('Введіть секретний код доступу'); return; }

    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/onboarding', {
        position,
        inviteCode: needsCode ? inviteCode.trim() : undefined,
      });
      completeOnboarding(data.token, data.role);
      navigate('/');
    } catch (err: any) {
      setError(
        axios.isAxiosError(err) && err.response
          ? err.response.data.message || 'Помилка налаштування профілю'
          : 'Щось пішло не так'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">

        <div className="onboarding-header">
          <div className="onboarding-icon">🪖</div>
          <h1 className="onboarding-title">Налаштування профілю</h1>
          <p className="onboarding-subtitle">
            Оберіть вашу посаду — система налаштує права доступу автоматично
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          <div className="onboarding-field">
            <label className="onboarding-label">Ваша посада</label>
            <select
              className="onboarding-select"
              value={position}
              onChange={e => handlePositionChange(e.target.value)}
              required
            >
              <option value="">— Оберіть посаду —</option>
              <optgroup label="Рядовий склад (без коду)">
                {POSITIONS.filter(p => !p.needsCode).map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Командний склад (потребує коду)">
                {POSITIONS.filter(p => p.needsCode).map(p => (
                  <option key={p.value} value={p.value}>{p.label} 🔐</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Блок секретного коду — з'являється тільки для вищих посад */}
          {showCode && (
            <div className="onboarding-field onboarding-code-field">
              <label className="onboarding-label">
                🔐 Секретний код доступу
              </label>
              <p className="onboarding-code-hint">
                Для цієї посади потрібен код, який видається розробником або адміністратором особисто.
              </p>
              <input
                className="onboarding-input"
                type="password"
                placeholder="Введіть код..."
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {/* Інфо-бейджик про роль */}
          {position && (
            <div className="onboarding-role-badge">
              <div className="onboarding-role-icon">
                {needsCode ? '🛡️' : '🎓'}
              </div>
              <div className="onboarding-role-text">
                <strong>{position}</strong>
                <span>{getRoleDescription(position)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="onboarding-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="onboarding-submit"
            disabled={loading || !position}
          >
            {loading
              ? <span className="auth-spinner" />
              : 'Підтвердити та увійти →'}
          </button>
        </form>
      </div>
    </div>
  );
};

function getRoleDescription(position: string): string {
  const map: Record<string, string> = {
    'Курсант':              'Перегляд власного розкладу та добової відомості',
    'Командир відділення':  'Розклад свого відділення, відмітка присутності',
    'Командир групи':       'Розклад своєї групи, заявки на заміну',
    'Старшина курсу':       'Генерація графіків, ручна заміна, управління особовим складом',
    'Начальник курсу':      'Повний доступ до курсу, затвердження графіків',
    'Начальник факультету': 'Глобальний перегляд, аналітика всіх курсів',
  };
  return map[position] || '';
}
