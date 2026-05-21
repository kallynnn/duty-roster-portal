import React, {
  useState,
  createContext,
  useContext,
  useEffect,
  useCallback
} from 'react';
import axios from 'axios';

const TOKEN_KEY    = 'auth-token';
const ROLE_KEY     = 'auth-role';
const FL_KEY       = 'auth-first-login';

interface IAuthContext {
  token:          string | null;
  isAuthenticated: boolean;
  role:           string | null;
  isFirstLogin:   boolean;
  login:          (token: string, role: string, isFirstLogin: boolean) => void;
  logout:         () => void;
  completeOnboarding: (newToken: string, newRole: string) => void;
}

const AuthContext = createContext<IAuthContext | null>(null);

let isInterceptorSetup = false;

const setupAxiosInterceptors = (logoutCallback: () => void) => {
  if (isInterceptorSetup) return;
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) logoutCallback();
      return Promise.reject(error);
    }
  );
  isInterceptorSetup = true;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token,        setToken]        = useState<string | null>(null);
  const [role,         setRole]         = useState<string | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState<boolean>(false);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(FL_KEY);
    setToken(null);
    setRole(null);
    setIsFirstLogin(false);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const login = (newToken: string, newRole: string, firstLogin: boolean) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ROLE_KEY,  newRole);
    localStorage.setItem(FL_KEY,    String(firstLogin));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setRole(newRole);
    setIsFirstLogin(firstLogin);
  };

  // Після onboarding — оновлюємо токен/роль, скидаємо прапор
  const completeOnboarding = (newToken: string, newRole: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(ROLE_KEY,  newRole);
    localStorage.setItem(FL_KEY,    'false');
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setRole(newRole);
    setIsFirstLogin(false);
  };

  useEffect(() => {
    setupAxiosInterceptors(logout);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedRole  = localStorage.getItem(ROLE_KEY);
    const storedFL    = localStorage.getItem(FL_KEY);
    if (storedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      setToken(storedToken);
      setRole(storedRole);
      setIsFirstLogin(storedFL === 'true');
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{
      token, isAuthenticated: !!token, role, isFirstLogin,
      login, logout, completeOnboarding,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
