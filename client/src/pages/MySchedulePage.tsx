import React from 'react';
import { Container } from 'react-bootstrap';
// 1. Імпортуємо наш компонент Календаря
import { ScheduleCalendar } from '../components/ScheduleCalendar';

export const MySchedulePage: React.FC = () => {
  return (
    <Container>
      <h2 className="my-4">Мій Графік Нарядів</h2>
      <p>Тут відображається твій особистий графік.</p>

      {/* 2. Викликаємо Календар і кажемо йому: 
        "Покажи графік ТІЛЬКИ для мене" (scope="mine")
      */}
      <ScheduleCalendar scope="mine" />

    </Container>
  );
};