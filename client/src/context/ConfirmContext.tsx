import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';

// Описуємо тип для опцій
interface IConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void; // Функція, яка виконається, якщо натиснули "Так"
}

// Описуємо, що буде зберігати наш Контекст
interface IConfirmContext {
  // Функція, яку ми будемо викликати
  ask: (options: IConfirmOptions) => void;
}

// 1. Оголошуємо Контекст (ТІЛЬКИ ОДИН РАЗ)
const ConfirmContext = createContext<IConfirmContext | null>(null);

// 2. Створюємо Провайдер
export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 'options' - тут зберігаються налаштування вікна (заголовок, текст)
  const [options, setOptions] = useState<IConfirmOptions | null>(null);

  // Функція, яку ми будемо викликати з компонентів
  const ask = (options: IConfirmOptions) => {
    setOptions(options);
  };

  // Функція, що спрацьовує при закритті вікна
  const handleClose = () => {
    setOptions(null); // Просто ховаємо вікно
  };

  // Функція, що спрацьовує при натисканні "Так"
  const handleConfirm = () => {
    if (options) {
      options.onConfirm(); // === ВИКЛИКАЄМО ту функцію, яку ми зберегли ===
    }
    handleClose(); // І закриваємо вікно
  };

  const isOpen = options !== null;

  return (
    <ConfirmContext.Provider value={{ ask }}>
      {children}

      {/* === НАШЕ МОДАЛЬНЕ ВІКНО === */}
      <Modal show={isOpen} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {/* Динамічний заголовок */}
            {options?.title || 'Підтвердження'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Динамічне повідомлення */}
          {options?.message || 'Ви впевнені?'}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Скасувати
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Так, підтвердити
          </Button>
        </Modal.Footer>
      </Modal>

    </ConfirmContext.Provider>
  );
};

// 3. Створюємо хук для легкого доступу
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};