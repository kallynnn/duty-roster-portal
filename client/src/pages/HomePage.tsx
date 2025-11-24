import React from 'react';
// === НОВЕ: Імпортуємо наш дашборд ===
import { StatisticsDashboard } from '../components/StatisticsDashboard';
import { useFetchData } from '../hooks/useFetchData';

// 1. Описуємо тип для новин (це залишається)
interface INews {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

// (Ми прибрали 'IGalleryImage', бо слайдера більше немає)

export const HomePage: React.FC = () => {
  // 2. Отримуємо 10 останніх новин (це залишається)
  const { data: news, isLoading: isLoadingNews } = useFetchData<INews[]>('/api/news?limit=10');

  // (Ми прибрали 'useFetchData' для галереї)

  return (
    <div>

      {/* === НОВЕ: Вставляємо Статистику === */}
      <div className="mb-4">
        <StatisticsDashboard />
      </div>

      {/* === СПИСОК 10 НОВИН (код без змін) === */}
      <h2>Останні новини</h2>

      {isLoadingNews ? (
        <p>Завантаження новин...</p>
      ) : (
        <div className="list-group">
          {news && news.length > 0 ? (
            news.map(item => (
              <div key={item.id} className="list-group-item list-group-item-action">
                <div className="d-flex w-100 justify-content-between">
                  <h5 className="mb-1">{item.title}</h5>
                  <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
                <p className="mb-1">{item.content.substring(0, 150)}...</p>
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