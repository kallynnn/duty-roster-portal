import React, { useState } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/uk';
import 'react-big-calendar/lib/css/react-big-calendar.css'; 

import { useFetchData } from '../hooks/useFetchData';
import { Row, Col, Button, Modal } from 'react-bootstrap'; 
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

// Налаштування локалізації (українська мова)
moment.locale('uk');
const localizer = momentLocalizer(moment);

// --- Типи даних ---
interface IScheduleEvent {
  id: number;
  date: string;
  soldier: { name: string };
  dutyType: { name: string };
}

interface ICalendarEvent {
  id: number;
  title: string; 
  start: Date;
  end: Date;
}

interface ScheduleCalendarProps {
  scope: 'all' | 'mine'; 
}

// === ПОЧАТОК КОМПОНЕНТА ===
export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ scope }) => {
  // 1. Хуки
  const { showToast } = useToast();
  const { ask } = useConfirm(); 

  // 2. Вибір API залежно від ролі (Командир чи Солдат)
  const apiUrl = scope === 'all' 
    ? '/api/schedule'           
    : '/api/schedule/my-schedule'; 

  // 3. Завантаження даних
  const { data: scheduleEvents, isLoading, refetch } = useFetchData<IScheduleEvent[]>(apiUrl);

  // 4. Стан (State)
  const [showModal, setShowModal] = useState(false); 
  const [selectedDayEvents, setSelectedDayEvents] = useState<ICalendarEvent[]>([]); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 
  const [date, setDate] = useState(new Date()); 
  const [view, setView] = useState<View>('month'); 
  const [isUpdating, setIsUpdating] = useState(false); // Стан для блокування кнопки

  // 5. Трансформація подій для календаря
  const events: ICalendarEvent[] = scheduleEvents ? scheduleEvents.map(event => ({
    id: event.id,
    title: `${event.dutyType.name}: ${event.soldier.name}`,
    start: new Date(event.date),
    end: new Date(event.date), 
  })) : [];

  // --- ФУНКЦІЇ ОБРОБНИКИ (Всі функції повинні бути ТУТ, до return) ---

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    const clickedDate = slotInfo.start;
    const dayEvents = events.filter(event => 
      event.start.toDateString() === clickedDate.toDateString()
    );
    setSelectedDayEvents(dayEvents);
    setSelectedDate(clickedDate);
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);
  const handleNavigate = (newDate: Date) => setDate(newDate);
  const handleView = (newView: View) => setView(newView);

  // === ВАША НОВА ФУНКЦІЯ ОНОВЛЕННЯ ===
  const handleRefresh = () => {
    ask({
      title: 'Оновити календар?',
      message: 'Ви впевнені, що хочете завантажити свіжі дані?',
      onConfirm: async () => {
        setIsUpdating(true); // Вмикаємо "Зачекайте..."
        try {
          await refetch(); // Реальне оновлення даних
          showToast('Дані успішно оновлено', 'success');
        } catch (error) {
          showToast('Помилка при оновленні', 'danger');
        } finally {
          setIsUpdating(false); // Вимикаємо "Зачекайте..."
        }
      }
    });
  };

  // Функція генерації графіка
  const handleGenerate = () => {
    const month = new Date().getMonth() + 1; 
    const year = new Date().getFullYear(); 

    ask({
      title: 'Підтвердити Генерацію',
      message: `Згенерувати новий графік на ${month}/${year}? Старий графік буде видалено.`,
      onConfirm: async () => { 
        try {
          const response = await axios.post('/api/schedule/generate', { month, year });
          showToast(response.data.message, 'success'); 
          refetch(); 
        } catch (err: any) {
          showToast(err.response?.data?.message || 'Помилка генерації', 'danger'); 
        }
      }
    });
  };

  // === ВІДОБРАЖЕННЯ (JSX) ===
  return (
    <div>
      <hr className="my-4" />
      <h3>Графік нарядів</h3>

      {/* Панель кнопок (Тільки для Командира) */}
      {scope === 'all' && (
        <div className="mb-3 p-3 border rounded">
          <Row>
            {/* Кнопка Генерації */}
            <Col md={3}>
              <Button variant="success" className="w-100" onClick={handleGenerate}>
                Згенерувати графік
              </Button>
            </Col>

            {/* === ВАША КНОПКА ОНОВЛЕННЯ === */}
            <Col md={3}>
              <Button 
                variant="info" 
                className="w-100" 
                onClick={handleRefresh} // Викликаємо функцію зверху
                disabled={isUpdating || isLoading}
              >
                {isUpdating ? 'Зачекайте...' : 'Оновити календар'}
              </Button>
            </Col>

            <Col>
              <p className="text-muted small">
                "Згенерувати" - створює новий. "Оновити" - завантажує зміни.
              </p>
            </Col>
          </Row>
        </div>
      )}

      {isLoading && <p>Завантаження графіку...</p>}

      {/* Календар (Висота обов'язкова) */}
      <div style={{ height: '600px' }}>
        <Calendar
          localizer={localizer}
          events={events} 
          startAccessor="start"
          endAccessor="end"
          messages={{ 
            next: "Наст.",
            previous: "Попер.",
            today: "Сьогодні",
            month: "Місяць",
            week: "Тиждень",
            day: "День",
            agenda: "Список",
            noEventsInRange: "У цьому діапазоні немає подій."
          }}
          selectable={true} 
          onSelectSlot={handleSelectSlot} 
          onSelectEvent={event => handleSelectSlot({ start: event.start })} 
          date={date} 
          view={view}   
          onNavigate={handleNavigate} 
          onView={handleView}         
        />
      </div>

      {/* Модальне вікно для перегляду подій дня */}
      <Modal show={showModal} onHide={handleCloseModal}>
         <Modal.Header closeButton>
          <Modal.Title>
            Графік на {selectedDate ? selectedDate.toLocaleDateString('uk-UA') : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDayEvents.length > 0 ? (
            <ul className="list-group">
              {selectedDayEvents.map(event => (
                <li key={event.id} className="list-group-item">
                  {event.title}
                </li>
              ))}
            </ul>
          ) : (
            <p>На цей день наряди не призначено.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Закрити
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};