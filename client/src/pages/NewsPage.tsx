import React, { useState, useEffect } from 'react';
import axios from 'axios';
// === НОВЕ: Імпортуємо 'Button', 'useAuth', 'useToast' ===
import { ListGroup, Spinner, Alert, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetchData } from '../hooks/useFetchData'; // Наш хук

// 1. Описуємо тип для новин
interface INews {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export const NewsPage: React.FC = () => {
  // 2. Отримуємо дані про користувача
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // 3. Завантажуємо ВСІ новини (без ліміту)
  // 'refetch' - це функція для оновлення списку
  const { data: news, isLoading, error, refetch } = useFetchData<INews[]>('/api/news');

  // === НОВЕ: Стан для кнопки завантаження ===
  const [isFetching, setIsFetching] = useState(false);

  // === НОВЕ: Функція для кнопки ===
  const handleFetchNews = async () => {
    setIsFetching(true);
    try {
      // Викликаємо той самий API, що й в адмінці
      const response = await axios.post('/api/news/fetch-external');
      showToast(response.data.message, 'success'); // "Успішно завантажено X новин"
      refetch(); // Оновлюємо список новин на сторінці
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Помилка завантаження', 'danger');
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2>Всі новини</h2>
          <p>Тут відображаються всі новини, завантажені в систему.</p>
        </div>

        {/* === НОВА КНОПКА === */}
        {/* Показуємо її, ТІЛЬКИ ЯКЩЩО користувач залогінений */}
        {isAuthenticated && (
          <Button 
            variant="outline-primary"
            onClick={handleFetchNews}
            disabled={isFetching} // Блокуємо, поки йде завантаження
          >
            {isFetching ? 'Завантаження...' : 'Завантажити свіжі новини'}
          </Button>
        )}
      </div>

      <hr />

      {isLoading ? (
        <p>Завантаження новин...</p>
      ) : error ? (
        <Alert variant="danger">Помилка завантаження новин.</Alert>
      ) : (
        <div className="list-group">
          {news && news.length > 0 ? (
            // 5. Малюємо список ВСІХ новин
            news.map(item => (
              <div key={item.id} className="list-group-item list-group-item-action mb-2">
                <div className="d-flex w-100 justify-content-between">
                  <h5 className="mb-1">{item.title}</h5>
                  <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
                {item.imageUrl && (
                  <img 
                    src={item.imageUrl} 
                    alt={item.title} 
                    className="img-fluid rounded my-2" 
                    style={{ maxHeight: '200px', objectFit: 'cover', width: '100%' }} 
                  />
                )}
                <p className="mb-1">{item.content}</p>
              </div>
            ))
          ) : (
            <p>Наразі новин немає.</p>
          )}
        </div>
      )}
    </div>
  );
};