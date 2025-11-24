import React, { 
  useState, 
  createContext, 
  useContext, 
  useEffect, 
  useCallback // <-- Імпортуємо useCallback
} from 'react';
import axios from 'axios';

const TOKEN_KEY = 'auth-token';

interface IAuthContext {
  token: string | null;
  isAuthenticated: boolean;
  role: string | null;
  login: (token: string, role: string) => void;
  logout: () => void;
}

const AuthContext = createContext<IAuthContext | null>(null);

// === Глобальна настройка Interceptor ===
// Ми робимо це один раз, щоб уникнути багатьох підписок
let isInterceptorSetup = false;

const setupAxiosInterceptors = (logoutCallback: () => void) => {
  // Налаштовуємо лише один раз
  if (isInterceptorSetup) return;

  axios.interceptors.response.use(
    (response) => response, // Успішні відповіді просто пропускаємо
    (error) => {
      // Якщо сервер повернув 401 (токен невалідний або просрочений)
      if (error.response && error.response.status === 401) {
        logoutCallback(); // Викликаємо логаут
      }
      return Promise.reject(error);
    }
  );
  isInterceptorSetup = true;
};
// =====================================


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Огортаємо logout в useCallback, щоб він не створювався заново
  // при кожному рендері. Це важливо для useEffect.
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('auth-role');
    setToken(null);
    setRole(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []); // [] = немає залежностей

  // Функція "Увійти"
  const login = (newToken: string, newRole: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem('auth-role', newRole);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setRole(newRole);
  };

  // При першому завантаженні
  useEffect(() => {
    // 1. Налаштовуємо глобальний "catch" для 401 помилок
    setupAxiosInterceptors(logout); 
    
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedRole = localStorage.getItem('auth-role');
    
    if (storedToken) {
      // 2. (ВИРІШЕННЯ ГОНКИ) Спочатку налаштовуємо axios...
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      
      // 3. ...а потім оновлюємо стан React
      setToken(storedToken);
      setRole(storedRole);
    }
  }, [logout]); // Додаємо 'logout' як залежність

  const value = {
    token,
    isAuthenticated: !!token, 
    role,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ... (ваш хук useAuth залишається без змін) ...
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};