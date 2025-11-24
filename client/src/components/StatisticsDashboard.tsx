import React, { useState, useEffect } from 'react';
import { Row, Col, Card, ListGroup, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // 1. Імпортуємо 'useAuth'

// Тип для Загальної статистики (з лідербордом)
interface IStatistics {
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
  leaderboard: { name: string; count: number }[];
}
// Тип для Моєї статистики (без лідерборду)
interface IMyStatistics {
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
}

export const StatisticsDashboard: React.FC = () => {
  // 2. Отримуємо дані про користувача
  // 'role' спочатку буде 'null', а ПОТІМ 'SOLDIER'
  const { isAuthenticated, role, token } = useAuth(); 

  const [stats, setStats] = useState<IStatistics | IMyStatistics | null>(null);
  // === НОВЕ: 'isLoading' за замовчуванням 'true' ===
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);

  // 3. 'useEffect' тепер буде залежати від 'role' та 'token'
  useEffect(() => {

    // Функція, яку ми будемо викликати
    const fetchData = async (url: string) => {
      try {
        setIsLoading(true); // Запускаємо завантаження
        setError(null);
        const response = await axios.get(url);
        setStats(response.data);
      } catch (err: any) {
        setError('Помилка завантаження статистики.');
      } finally {
        setIsLoading(false); // Завершуємо завантаження
      }
    };

    // === НОВА, "РОЗУМНА" ЛОГІКА ===

    if (isAuthenticated) {
      // Користувач залогінений.
      // Ми ПОВИННІ дочекатися, поки 'role' завантажиться
      if (role) { 
        // 'role' завантажено! Тепер вирішуємо.
        if (role === 'SOLDIER') {
          fetchData('/api/statistics/my-summary'); // Особистий API
        } else {
          // 'role' = 'COMMANDER'
          fetchData('/api/statistics/summary'); // Загальний API
        }
      }
      // Якщо 'role' === null, ми нічого не робимо (чекаємо наступного ре-рендера)

    } else {
      // Користувач - Гість. Завантажуємо загальну статистику
      fetchData('/api/statistics/summary');
    }

  }, [isAuthenticated, role, token]); // Пере-запускати, коли 'role' зміниться

  if (isLoading) {
    return <Spinner animation="border" />; // Поки йде завантаження
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>; 
  }

  if (!stats) {
    return <p>Немає даних.</p>;
  }

  // 4. "Розумний" заголовок
  const titlePrefix = (isAuthenticated && role === 'SOLDIER') ? 'Моїх нарядів' : 'Нарядів';

  return (
    <Row>
      {/* Картка "Цей тиждень" */}
      <Col md={3}>
        <Card className="text-center shadow-sm h-100">
          <Card.Body>
            <Card.Title>{titlePrefix} за Тиждень</Card.Title>
            <Card.Text className="display-4 fw-bold">
              {stats.thisWeekCount}
            </Card.Text>
          </Card.Body>
        </Card>
      </Col>

      {/* Картка "Цей місяць" */}
      <Col md={3}>
        <Card className="text-center shadow-sm h-100">
          <Card.Body>
            <Card.Title>{titlePrefix} за Місяць</Card.Title>
            <Card.Text className="display-4 fw-bold">
              {stats.thisMonthCount}
            </Card.Text>
          </Card.Body>
        </Card>
      </Col>

      {/* Картка "Цей рік" */}
      <Col md={3}>
        <Card className="text-center shadow-sm h-100">
          <Card.Body>
            <Card.Title>{titlePrefix} за Рік</Card.Title>
            <Card.Text className="display-4 fw-bold">
              {stats.thisYearCount}
            </Card.Text>
          </Card.Body>
        </Card>
      </Col>

      {/* === 5. "Розумний" Лідерборд === */}
      {/* Показуємо, ТІЛЬКИ ЯКЩО це НЕ Солдат */}
      {(!isAuthenticated || role !== 'SOLDIER') && (
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <Card.Header as="h5" className="text-center">Топ-3 (за місяць)</Card.Header>
            <ListGroup variant="flush">
              {'leaderboard' in stats && stats.leaderboard.length > 0 ? (
                stats.leaderboard.map((entry, index) => (
                  <ListGroup.Item key={index} className="d-flex justify-content-between">
                    <strong>{index + 1}. {entry.name}</strong>
                    <span className="badge bg-primary rounded-pill">{entry.count}</span>
                  </ListGroup.Item>
                ))
              ) : (
                <ListGroup.Item>Даних немає</ListGroup.Item>
              )}
            </ListGroup>
          </Card>
        </Col>
      )}

    </Row>
  );
};