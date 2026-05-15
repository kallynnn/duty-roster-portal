import React from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { StatisticsDashboard } from '../components/StatisticsDashboard';
import { useAuth } from '../context/AuthContext';

export const MySchedulePage: React.FC = () => {
  const { role } = useAuth();

  return (
    <Container className="mt-4">
      {/* Заголовок */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <h2 className="mb-1">Мій Графік</h2>
              <p className="text-muted mb-0">
                Перегляд ваших особистих нарядів та статистики.
                {role === 'SOLDIER' && (
                  <span className="ms-2 badge bg-info text-dark">Солдат</span>
                )}
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Статистика */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3">📊 Моя статистика</h5>
          <StatisticsDashboard />
        </Col>
      </Row>

      {/* Підказка для солдата */}
      <Alert variant="info" className="d-flex align-items-center gap-2">
        <span>ℹ️</span>
        <span>
          Нижче відображається ваш особистий графік нарядів.
          Для перегляду деталей дня — натисніть на дату або подію.
        </span>
      </Alert>

      {/* Календар (тільки мій) */}
      <Row>
        <Col>
          <ScheduleCalendar scope="mine" />
        </Col>
      </Row>
    </Container>
  );
};