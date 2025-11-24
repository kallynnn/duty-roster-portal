import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Spinner, Alert, Row, Col } from 'react-bootstrap';
import axios from 'axios';

// 1. Описуємо тип даних, які ми очікуємо з Backend
interface ISoldierProfile {
  id: number;
  name: string;
  rank: string;
  position: string;
  phoneNumber: string | null;
  status: string;
}

interface IProfileData {
  id: number;
  email: string;
  role: 'SOLDIER' | 'COMMANDER' | 'ADMIN';
  soldier: ISoldierProfile | null;
}

export const MyProfilePage: React.FC = () => {
  // 2. Створюємо стани для даних, завантаження та помилок
  const [profile, setProfile] = useState<IProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3. Завантажуємо дані при першому рендері
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        // Викликаємо наш новий API
        // (Axios автоматично додасть наш auth-token з AuthContext)
        const response = await axios.get('/api/auth/me');
        setProfile(response.data);
      } catch (err: any) {
        setError('Помилка завантаження профілю.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []); // [] = виконати 1 раз

  // --- Логіка відображення ---

  if (isLoading) {
    return <Spinner animation="border" />; // Поки йде завантаження
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>; // Якщо помилка
  }

  if (!profile) {
    return <Alert variant="warning">Профіль не знайдено.</Alert>;
  }

  // 4. Малюємо сторінку
  return (
    <Container>
      <h2 className="my-4">Мій Профіль</h2>

      <Row>
        <Col md={6}>
          <Card>
            <Card.Header><h4>Дані Акаунту</h4></Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong>Email:</strong> {profile.email}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>ID Користувача:</strong> {profile.id}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Роль:</strong> {profile.role}
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>

        <Col md={6}>
          {profile.soldier ? (
            // Якщо профіль солдата знайдено
            <Card>
              <Card.Header><h4>Профіль Військовослужбовця</h4></Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <strong>ПІБ:</strong> {profile.soldier.name}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Звання:</strong> {profile.soldier.rank}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Посада:</strong> {profile.soldier.position}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Телефон:</strong> {profile.soldier.phoneNumber || 'Не вказано'}
                </ListGroup.Item>
                <ListGroup.Item>
                  <strong>Статус:</strong> {profile.soldier.status}
                </ListGroup.Item>
              </ListGroup>
            </Card>
          ) : (
            // Якщо профіль солдата НЕ знайдено (напр., для 'ADMIN' без профілю)
            <Alert variant="info">Профіль військовослужбовця не прив'язаний до цього акаунту.</Alert>
          )}
        </Col>
      </Row>

    </Container>
  );
};