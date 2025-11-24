import React from 'react';
import { useAuth } from '../context/AuthContext';
// === НОВЕ: Прибираємо 'Form' та 'Alert' з імпортів ===
import { Container, Row, Col } from 'react-bootstrap';

// === ІМПОРТИ ТВОГО "ЯДРА" ПРОЄКТУ ===
import { SoldierManager } from '../components/SoldierManager';
import { DutyTypeManager } from '../components/DutyTypeManager';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { NewsManager } from '../components/NewsManager';

export const DashboardPage: React.FC = () => {
  const { role } = useAuth(); // Ми все ще показуємо роль

  // (Всі 'useState' для новин/галереї - ВИДАЛЕНО)
  // (Всі 'handleNewsSubmit', 'handleGallerySubmit' - ВИДАЛЕНО)

  return (
    <Container>
      <Row>
        <Col>
          <h2>Панель Управління</h2>
          <p>Ваша роль: <strong>{role}</strong></p>

          {/* (Всі форми для новин/галереї - ВИДАЛЕНО) */}

          {/* === КЕРУВАННЯ ОСОБОВИМ СКЛАДОМ === */}
          <SoldierManager />

          {/* === КЕРУВАННЯ ВИДАМИ НАРЯДІВ === */}
          <DutyTypeManager />

          {/* === ГРАФІК НАРЯДІВ === */}
          <ScheduleCalendar scope="all" />
          <NewsManager />

        </Col>
      </Row>
    </Container>
  );
};