import React, { useState } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/uk';
import 'react-big-calendar/lib/css/react-big-calendar.css'; 

import { useFetchData } from '../hooks/useFetchData';
import { Row, Col, Button, Modal, Form} from 'react-bootstrap'; 
import axios from 'axios';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
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
  const [exportDate, setExportDate] = useState(''); // Зберігає обрану дату у форматі YYYY-MM-DD
  const { showToast } = useToast();
  const { ask } = useConfirm(); 

  // 2. Вибір API залежно від ролі (Командир чи Солдат)
  const apiUrl = scope === 'all' 
    ? '/api/schedule'           
    : '/api/schedule/my-schedule'; 

  // 3. Завантаження даних
  const { data: scheduleEvents, isLoading, refetch } = useFetchData<IScheduleEvent[]>(apiUrl);

  // 4. Стан (State)
  
  
  const [date, setDate] = useState(new Date()); 
  const [view, setView] = useState<View>('month'); 
  const [isUpdating, setIsUpdating] = useState(false); // Стан для блокування кнопки

  // Стан для вікна заміни
// === СТАН ДЛЯ ВІКНА РУЧНОЇ ЗАМІНИ ===
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapDate, setSwapDate] = useState<Date | null>(null); // Зберігаємо дату кліку
  const [selectedDutyTypeId, setSelectedDutyTypeId] = useState<string>(''); // Вибраний пост
  const [targetScheduleId, setTargetScheduleId] = useState<number | null>(null); // ID запису, який міняємо
  
  const [soldiersList, setSoldiersList] = useState<any[]>([]);
  const [newSoldierId, setNewSoldierId] = useState('');
 // === СТАН ДЛЯ ВІКНА ДЕННОГО СПИСКУ (+ more) ===
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyDate, setDailyDate] = useState<Date | null>(null);
  const [dailyEvents, setDailyEvents] = useState<any[]>([]);

  // Функція, яка відкриває список
  const handleShowMore = (eventsList: any[], date: Date) => {
    setDailyDate(date);
    setDailyEvents(eventsList);
    setShowDailyModal(true);
  };

  // 5. Трансформація подій для календаря
  const events: ICalendarEvent[] = scheduleEvents ? scheduleEvents.map((event: any) => ({
    id: event.id,
    title: `${event.dutyType.name}: ${event.soldier.name}`,
    start: new Date(event.date),
    end: new Date(event.date),
    
    // === ОБОВ'ЯЗКОВО ДОДАЙ ЦІ РЯДКИ ===
    dutyTypeId: event.dutyTypeId, 
    dutyTypeName: event.dutyType.name,
    soldierName: event.soldier.name
  })) : [];
  

  // --- ФУНКЦІЇ ОБРОБНИКИ (Всі функції повинні бути ТУТ, до return) ---

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    const clickedDate = slotInfo.start;
    
    // Шукаємо всі наряди на день, по якому клікнули
    const dayEvents = events.filter((event: any) => 
      event.start.toDateString() === clickedDate.toDateString()
    );
    
    // ВІДКРИВАЄМО НАШЕ НОВЕ КРУТЕ ВІКНО!
    handleShowMore(dayEvents, clickedDate); 
  };


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
  // === ФУНКЦІЯ ЕКСПОРТУ В PDF ===
 // === НОВА ФУНКЦІЯ ЕКСПОРТУ В EXCEL ===
const exportToExcel = () => {
    // 1. Фільтруємо наряди за обраною датою
    let filteredEvents = events;
    if (exportDate) {
      // Залишаємо тільки ті наряди, дата яких збігається з exportDate
      filteredEvents = events.filter((e: any) => moment(e.start).format('YYYY-MM-DD') === exportDate);
    }

    // 2. Перевірка: чи є взагалі наряди на цей день?
    if (filteredEvents.length === 0) {
      alert(exportDate ? `На ${moment(exportDate).format('DD.MM.YYYY')} немає нарядів!` : 'Графік порожній!');
      return;
    }

    // 3. Формуємо дані
    const tableData = filteredEvents.map((event: any) => {
      const parts = event.title.split(': ');
      const dutyName = parts[0] || 'Невідомо';
      const soldierName = parts[1] || 'Невідомо';
      
      return {
        'Дата': moment(event.start).format('DD.MM.YYYY'),
        'Військовослужбовець': soldierName,
        'Вид наряду': dutyName
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, exportDate ? "Витяг" : "Графік");

    // 4. Динамічна назва файлу (якщо є дата - пишемо її у назву файлу)
    const fileName = exportDate 
      ? `Dobova_Vidomist_${moment(exportDate).format('DD_MM_YYYY')}.xlsx` 
      : `Hrafik_Nariadiv_${moment().format('MM_YYYY')}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };
  // === ФУНКЦІЯ РОЗФАРБОВУВАННЯ НАРЯДІВ ===
  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#3174ad'; // Стандартний синій

    // Шукаємо ключові слова в назві наряду і даємо їм колір
    const title = event.title.toLowerCase();
    
    if (title.includes('пожежний')) backgroundColor = '#dc3545'; // Червоний (Небезпека)
    else if (title.includes('кпп') || title.includes('пропускн')) backgroundColor = '#fd7e14'; // Оранжевий
    else if (title.includes('курсу') || title.includes('підрозділ')) backgroundColor = '#198754'; // Зелений
    else if (title.includes('навч. корп')) backgroundColor = '#0dcaf0'; // Блакитний
    else if (title.includes('штабу')) backgroundColor = '#6f42c1'; // Фіолетовий
    else if (title.includes('гуртожитку')) backgroundColor = '#ffc107'; // Жовтий (з чорним текстом)

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: title.includes('гуртожитку') ? '#000' : '#fff', // Для жовтого фону робимо чорний текст
        border: 'none',
        display: 'block',
        fontSize: '12px',
        padding: '2px 5px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis' // Додає три крапки, якщо текст не влазить
      }
    };
  };
  // Коли клікаємо на подію в календарі
 // Коли клікаємо на подію в календарі
  const handleEventClick = async (event: any) => {
    setSwapDate(event.start); // Запам'ятовуємо дату
    setSelectedDutyTypeId(event.dutyTypeId?.toString() || ''); // Одразу вибираємо пост, на який клікнули
    setTargetScheduleId(event.id); // Одразу ставимо галочку на ту людину, на яку клікнули
    setNewSoldierId(''); 
    setShowSwapModal(true);

    try {
      const res = await axios.get('/api/soldiers');
      setSoldiersList(res.data.filter((s: any) => s.status === 'ACTIVE'));
    } catch (error) {
      console.error("Не вдалося завантажити список особового складу");
    }
  };

  // Коли натискаємо "Зберегти заміну"
  // Коли натискаємо "Зберегти заміну"
  // Коли натискаємо "Виконати заміну"
  const handleSwapSubmit = async () => {
    if (!targetScheduleId) return alert('Оберіть, кого саме ви хочете зняти з наряду (Крок 2)!');
    if (!newSoldierId) return alert('Оберіть нового чергового (Крок 3)!');

    try {
      // Відправляємо запит саме на той ID, який ми вибрали галочкою
      await axios.put(`/api/schedule/${targetScheduleId}`, { newSoldierId });
      setShowSwapModal(false);
      showToast('Заміну успішно виконано', 'success');
      refetch();
    } catch (error) {
      showToast('Помилка при заміні. Перевір консоль.', 'danger');
    }
  };
  return (
    <div>
      <hr className="my-4" />
      <div className="d-flex justify-content-between align-items-center mb-3">
  <h3 className="mb-0">Графік нарядів</h3>
  
  {/* НОВА ПАНЕЛЬ ЕКСПОРТУ */}
  <div className="d-flex align-items-center gap-2">
    <Form.Control 
      type="date" 
      value={exportDate}
      onChange={(e) => setExportDate(e.target.value)}
      title="Оберіть день для витягу"
    />
    <Button 
      variant="success" 
      onClick={exportToExcel} 
      disabled={events.length === 0}
      className="text-nowrap"
    >
      {exportDate ? '📥 Витяг за день' : '📥 Весь місяць'}
    </Button>
  </div>
</div>

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
          // === ДОДАЄМО ЦІ ДВА РЯДКИ ===
        popup={false} // Це обов'язково false, щоб не вилазило те синє вікно
  onShowMore={handleShowMore} // Тепер календар віддає дані нашій функції
  onSelectEvent={handleEventClick} // Твоя заміна по кліку на конкретне прізвище теж працюватиме
  onDrillDown={() => {}}
          // ===========================
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
         
          date={date} 
          view={view}   
          onNavigate={handleNavigate} 
          onView={handleView}         
        />
      </div>      
{/* === ВІКНО РУЧНОЇ ЗАМІНИ === */}
      {/* === ВІКНО РУЧНОЇ ЗАМІНИ (V3: 3 КРОКИ) === */}
      <Modal show={showSwapModal} onHide={() => setShowSwapModal(false)}>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title>Ручна заміна в наряді</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {swapDate && <p className="mb-3"><strong>Дата чергування:</strong> {swapDate.toLocaleDateString('uk-UA')}</p>}

          {/* ЛОГІКА ФІЛЬТРАЦІЇ (Виконується прямо тут) */}
          {(() => {
            // 1. Беремо всі події тільки за цю дату
            const eventsOnDate = events.filter((e: any) => swapDate && e.start.toDateString() === swapDate.toDateString());
            
            // 2. Збираємо унікальні пости для списку
            const uniqueDutiesMap = new Map();
            eventsOnDate.forEach((e: any) => uniqueDutiesMap.set(e.dutyTypeId, e.dutyTypeName));
            const uniqueDuties = Array.from(uniqueDutiesMap, ([id, name]) => ({ id, name }));

            // 3. Беремо людей, які стоять на вибраному посту
            const peopleOnSelectedPost = eventsOnDate.filter((e: any) => e.dutyTypeId?.toString() === selectedDutyTypeId);

            return (
              <>
                {/* КРОК 1: ВИБІР ПОСТУ */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">1. Оберіть пост для заміни:</Form.Label>
                  <Form.Select 
                    value={selectedDutyTypeId} 
                    onChange={(e) => {
                      setSelectedDutyTypeId(e.target.value);
                      setTargetScheduleId(null); // Скидаємо вибір людини при зміні поста
                    }}
                  >
                    <option value="">-- Оберіть пост --</option>
                    {uniqueDuties.map(duty => (
                      <option key={duty.id} value={duty.id}>{duty.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* КРОК 2: ВИБІР ЛЮДИНИ (РАДІОКНОПКИ) */}
                {selectedDutyTypeId && peopleOnSelectedPost.length > 0 && (
                  <Form.Group className="mb-4 p-3 bg-light rounded border border-danger">
                    <Form.Label className="fw-bold text-danger mb-2">2. Кого знімаємо з наряду?</Form.Label>
                    {peopleOnSelectedPost.map((person: any) => (
                      <Form.Check 
                        key={person.id}
                        type="radio"
                        id={`person-${person.id}`}
                        name="targetPerson"
                        label={person.soldierName}
                        value={person.id}
                        checked={targetScheduleId === person.id}
                        onChange={() => setTargetScheduleId(person.id)}
                        className="mb-1"
                      />
                    ))}
                  </Form.Group>
                )}
              </>
            );
          })()}

          {/* КРОК 3: НА КОГО МІНЯЄМО */}
          <Form.Group>
            <Form.Label className="fw-bold text-success">3. Ким замінити?</Form.Label>
            <Form.Select 
              value={newSoldierId} 
              onChange={(e) => setNewSoldierId(e.target.value)}
              disabled={!targetScheduleId} // Блокуємо, якщо не вибрали кого знімати
            >
              <option value="">-- Виберіть зі списку --</option>
              {soldiersList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.rank} {s.name} ({s.position})
                </option>
              ))}
            </Form.Select>
          </Form.Group>

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSwapModal(false)}>
            Скасувати
          </Button>
          <Button variant="success" onClick={handleSwapSubmit} disabled={!targetScheduleId || !newSoldierId}>
            🔄 Виконати заміну
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showDailyModal} onHide={() => setShowDailyModal(false)} size="lg" centered>
  <Modal.Header closeButton className="bg-primary text-white">
    <Modal.Title>
      Добова відомість на {dailyDate ? dailyDate.toLocaleDateString('uk-UA') : ''}
    </Modal.Title>
  </Modal.Header>
  <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
    {dailyEvents.length > 0 ? (
      <div className="list-group">
        {Object.entries(
          dailyEvents.reduce((acc: any, event: any) => {
            const type = event.dutyTypeName || "Інше";
            if (!acc[type]) acc[type] = [];
            acc[type].push(event.soldierName);
            return acc;
          }, {})
        ).map(([dutyType, soldiers]: [string, any]) => (
          <div key={dutyType} className="list-group-item border-start border-4 border-primary mb-2 shadow-sm">
            <h6 className="fw-bold text-uppercase text-secondary mb-2" style={{ fontSize: '0.9rem' }}>
              {dutyType}
            </h6>
            <ul className="mb-0 list-unstyled">
              {soldiers.map((name: string, index: number) => (
                <li key={index} className="py-1 border-top-sm">
                  — {name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-center text-muted">Нарядів не знайдено</p>
    )}
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowDailyModal(false)}>
      Закрити
    </Button>
  </Modal.Footer>
</Modal>
    </div>
  );
};