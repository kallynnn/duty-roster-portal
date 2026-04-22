import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { ScheduleCalendar } from '../components/ScheduleCalendar';

export const HomePage: React.FC = () => {
  const { role } = useAuth(); // Отримуємо роль користувача

  return (
    <Container className="mt-4">
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h2 className="mb-2">Головна сторінка</h2>
              <p className="text-muted mb-0">
                Вітаємо у Системі Управління Чергуваннями! Ваша поточна роль: <strong>{role}</strong>. 
                Нижче наведено актуальний графік нарядів.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          {/* Відображаємо календар */}
          {/* Якщо твій ScheduleCalendar підтримує фільтрацію (наприклад, scope="personal"), 
              можеш передати відповідний проп. Поки що виводимо стандартний. */}
          <ScheduleCalendar scope="all" />
        </Col>
      </Row>
    </Container>
  );
};