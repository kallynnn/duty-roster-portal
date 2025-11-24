import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import axios from 'axios'; // <-- 1. ІМПОРТУЄМО AXIOS
// === НАЛАШТУВАННЯ AXIOS ===
// Якщо ми на Vercel, ця змінна буде вказувати на Render.
// Якщо ми вдома, вона буде порожня, і ми використаємо localhost.
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Встановлюємо Базову URL для всіх запитів!
axios.defaults.baseURL = apiUrl;

// Встановлюємо токен, якщо він є
const token = localStorage.getItem('auth-token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
// === КІНЕЦЬ НОВОЇ ЛОГІКИ ===

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
);

reportWebVitals();