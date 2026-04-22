import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col } from 'react-bootstrap';

// Імпортуємо твої компоненти
import { SoldierManager } from '../components/SoldierManager';
import { DutyTypeManager } from '../components/DutyTypeManager';
import { ScheduleCalendar } from '../components/ScheduleCalendar';


export const DashboardPage: React.FC = () => {
  const { role } = useAuth(); 

  return (
    <Container>
      <Row>
        <Col>
          <h2 className="my-4">Панель Управління</h2>
          <p>Ваша роль: <strong>{role}</strong></p>

          {/* === 1. Керування солдатами === */}
          <SoldierManager />

          {/* === 2. Керування нарядами === */}
          <DutyTypeManager />

          {/* === 3. ГРАФІК (КАЛЕНДАР) === */}
          <ScheduleCalendar scope="all" />
        </Col>
      </Row>
    </Container>
  );
};