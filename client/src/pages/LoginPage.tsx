import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import logo from '../mitit.png';

export const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      login(data.token, data.role, data.isFirstLogin);
      navigate(data.isFirstLogin ? '/onboarding' : '/');
    } catch (err: any) {
      setError(axios.isAxiosError(err) && err.response
        ? err.response.data.message || 'Помилка входу'
        : 'Щось пішло не так');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split">

      {/* ── Ліва панель — брендинг ── */}
      <div className="login-brand">
        <div className="login-brand-inner">
          <img src={logo} alt="ВІТІ" className="login-brand-logo" />
          <h1 className="login-brand-title">ВІТІ</h1>
          <p className="login-brand-full">
            Військовий інститут<br />
            телекомунікацій та інформатизації
          </p>
          <div className="login-brand-divider" />
          <div className="login-brand-facts">
            <div className="login-brand-fact">
              <span className="login-brand-fact-num">DutyPortal</span>
              <span className="login-brand-fact-lbl">Система управління чергуваннями</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Права панель — форма ── */}
      <div className="login-form-side">
        <div className="auth-card login-form-card">

          <div className="auth-logo">
            <div className="auth-logo-icon">🛡️</div>
            <h1 className="auth-title">Вхід до системи</h1>
            <p className="auth-subtitle">DutyPortal · ВІТІ</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">✉️</span>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="your@viti.edu.ua"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Пароль</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">🔒</span>
                <input
                  className="auth-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Введіть пароль"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error"><span>⚠️</span> {error}</div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Увійти в систему'}
            </button>
          </form>

          <div className="auth-footer">
            Немає акаунту?{' '}
            <Link to="/register" className="auth-link">Зареєструватися</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
