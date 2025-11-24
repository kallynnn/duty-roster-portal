import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

// Описуємо тип для одного "Тоста"
interface IToast {
  id: number;
  message: string;
  variant: 'success' | 'danger' | 'warning' | 'info'; // Кольори
}

// Описуємо, що буде зберігати наш Контекст
interface IToastContext {
  showToast: (message: string, variant: IToast['variant']) => void;
}

const ToastContext = createContext<IToastContext | null>(null);

// Створюємо Провайдер
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 'toasts' - це МАСИВ, де будуть жити всі наші сповіщення
  const [toasts, setToasts] = useState<IToast[]>([]);

  // Функція, яку ми будемо викликати з будь-якого компонента
  const showToast = (message: string, variant: IToast['variant']) => {
    const id = Date.now(); // Унікальний ID
    setToasts(prevToasts => [
      ...prevToasts, 
      { id, message, variant }
    ]);
  };

  // Функція для видалення "Тоста"
  const removeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* === "РЕНДЕРЕР" ТОСТІВ === */}
      {/* Це місце, де всі тости будуть фізично з'являтися */}
      <ToastContainer
        position="top-end" // У верхньому правому кутку
        className="p-3"
        style={{ zIndex: 9999 }} // Гарантуємо, що вони поверх усього
      >
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            // 'bg' - це колір фону, який Bootstrap автоматично підбере
            bg={toast.variant}
            onClose={() => removeToast(toast.id)} // Закриття по "хрестику"
            delay={4000} // Автоматично зникає через 4 секунди
            autohide
          >
            <Toast.Body className={toast.variant === 'warning' ? 'text-dark' : 'text-white'}>
              {toast.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

    </ToastContext.Provider>
  );
};

// Створюємо хук для легкого доступу
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};