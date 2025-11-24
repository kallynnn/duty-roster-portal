import React from 'react';
import { Table, Button, Alert } from 'react-bootstrap';
import { useFetchData } from '../hooks/useFetchData'; // Використовуємо наш хук
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

// Тип для Новин
interface INews {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export const NewsManager: React.FC = () => {
  // Завантажуємо ВСІ новини (без ліміту)
  const { data: news, isLoading, error, refetch } = useFetchData<INews[]>('/api/news');
  const { showToast } = useToast();
  const { ask } = useConfirm(); // Наш хук для pop-up підтвердження

  // Функція для видалення
  const handleDelete = (id: number, title: string) => {
    ask({
      title: 'Підтвердити Видалення',
      message: `Ви впевнені, що хочете видалити новину "${title}"?`,

      onConfirm: async () => {
        try {
          // Викликаємо наш новий API
          await axios.delete(`http://localhost:5000/api/news/${id}`);
          showToast('Новину успішно видалено', 'success');
          refetch(); // Оновлюємо список
        } catch (err: any) {
          showToast(err.response?.data?.message || 'Помилка видалення', 'danger');
        }
      }
    });
  };

  return (
    <div>
      <hr className="my-4" />
      <h3>Керування новинами</h3>

      {isLoading && <p>Завантаження списку новин...</p>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Заголовок</th>
            <th>Дата</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          {news && news.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.title}</td>
              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
              <td>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => handleDelete(item.id, item.title)}
                >
                  Видалити
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};