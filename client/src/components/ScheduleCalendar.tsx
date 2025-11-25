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

moment.locale('uk');
const localizer = momentLocalizer(moment);

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

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ scope }) => {
  const { showToast } = useToast();
  const { ask } = useConfirm();

  const apiUrl = scope === 'all' 
    ? '/api/schedule'           
    : '/api/schedule/my-schedule'; 

  const { data: scheduleEvents, isLoading, refetch } = useFetchData<IScheduleEvent[]>(apiUrl);

  const [showModal, setShowModal] = useState(false); 
  const [selectedDayEvents, setSelectedDayEvents] = useState<ICalendarEvent[]>([]); 
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 
  const [date, setDate] = useState(new Date()); 
  const [view, setView] = useState<View>('month'); 
  
  // === НОВЕ: Стан для кнопки оновлення ===
  const [isUpdating, setIsUpdating] = useState(false);

  const events: ICalendarEvent[] = scheduleEvents ? scheduleEvents.map(event => ({
    id: event.id,
    title: `${event.dutyType.name}: ${event.soldier.name}`,
    start: new Date(event.date),
    end: new Date(event.date), 
  })) : [];

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

  // === НОВЕ: Функція ручного оновлення ===
  const handleRefresh = async () => {
    setIsUpdating(true);
    try {
      await refetch();
      showToast('Календар актуалізовано', 'success');
    } catch (error) {
      showToast('Не вдалося оновити дані', 'danger');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerate = () => {
    const month = new Date().getMonth() + 1; 
    const year = new Date().getFullYear(); 

    ask({
      title: 'Підтвердити Генерацію',
      message: `Ви впевнені, що хочете згенерувати новий графік на ${month}/${year}? Старий графік на цей місяць буде видалено.`,
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

  return (
    <div>
      <hr className="my-4" />
      <h3>Графік нарядів</h3>

      {scope === 'all' && (
        <div className="mb-3 p-3 border rounded">
          <Row>
            <Col md={3}>
              <Button variant="success" className="w-100" onClick={handleGenerate}>
                Згенерувати графік
              </Button>
            </Col>

            {/* === ОНОВЛЕНА КНОПКА === */}
            <Col md={3}>
              <Button 
                variant="info" 
                className="w-100" 
                onClick={handleRefresh}
                disabled={isUpdating || isLoading} // Блокуємо при завантаженні
              >
                 {isUpdating ? (
                    <>
                      {/* Спіннер Bootstrap */}
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Оновлення...
                    </>
                 ) : 'Оновити календар'}
              </Button>
            </Col>

            <Col>
              <p className="text-muted small">
                "Згенерувати" - для створення нового графіку. "Оновити" - для завантаження змін.
              </p>
            </Col>
          </Row>
        </div>
      )}

      {isLoading && <p>Завантаження графіку...</p>}

      {/* Контейнер без білого фону (щоб працювала темна тема) */}
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
// Update for deployment