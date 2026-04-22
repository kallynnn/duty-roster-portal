import React, { useState } from 'react';
// === НОВЕ: Імпортуємо Modal ===
import { Table, Button, Form, Row, Col, Alert, Badge, Modal, Spinner } from 'react-bootstrap';
import { useFetchData } from '../hooks/useFetchData';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { MILITARY_RANKS, MILITARY_POSITIONS } from '../utils/constants';
import * as XLSX from 'xlsx';


interface ISoldier {
  id: number;
  name: string;
  rank: string;
  status: 'ACTIVE' | 'LEAVE' | 'SICK';
  user: { email: string }
}

export const SoldierManager: React.FC = () => {
  const { data: soldiers, isLoading, error, refetch } = useFetchData<ISoldier[]>('/api/soldiers');
  const { showToast } = useToast();
  const { ask } = useConfirm();
  // Стан для масового імпорту
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Стани для форми додавання
  const [newName, setNewName] = useState('');
  const [newRank, setNewRank] = useState('');
  const [formError, setFormError] = useState('');
  const [newPosition, setNewPosition] = useState('');
  // Стан для керування вікном редагування
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    rank: 'Курсант',
    position: 'Курсант',
    phoneNumber: '',
    status: 'ACTIVE',
    platoon: '', // <--- ДОДАЛИ
    squad: ''    // <--- ДОДАЛИ
  });

  // === НОВЕ: Стани для модального вікна Редагування ===
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSoldier, setEditingSoldier] = useState<ISoldier | null>(null);
  // Стани для полів у модальному вікні
  const [editName, setEditName] = useState('');
  const [editRank, setEditRank] = useState('');

  // Функція для ДОДАВАННЯ
  const handleAddSoldier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await axios.post('/api/soldiers', { name: newName, rank: newRank, position: newPosition });
      setNewName('');
      setNewRank('');
      setNewPosition('');
      refetch(); 
    } catch (err) {
      setFormError('Помилка додавання. Перевірте поля.');
    }
  };
  // Функція масового імпорту
  const handleBulkImport = async () => {
    if (!bulkText.trim()) return showToast('Введіть список курсантів', 'warning');
    setIsImporting(true);
    try {
      const response = await axios.post('/api/soldiers/bulk', { text: bulkText });
      showToast(response.data.message, 'success');
      setBulkText('');
      setShowBulkModal(false);
      refetch(); // Оновлюємо таблицю
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Помилка імпорту', 'danger');
    } finally {
      setIsImporting(false);
    }
  };
  // === ФУНКЦІЯ ЗАВАНТАЖЕННЯ EXCEL ФАЙЛУ ===
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsImporting(true);
  const reader = new FileReader();

  reader.onload = async (evt) => {
    try {
      // Читаємо файл
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });

      // Беремо першу сторінку таблиці
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];

      // Перетворюємо таблицю на масив об'єктів (JSON)
      const data = XLSX.utils.sheet_to_json(ws);

      // Відправляємо на сервер
      const response = await axios.post('/api/soldiers/import-excel', { soldiers: data });
      showToast(response.data.message, 'success');

      refetch(); // Оновлюємо таблицю на екрані
      setShowBulkModal(false); // Закриваємо модалку
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Помилка читання файлу', 'danger');
    } finally {
      setIsImporting(false);
      e.target.value = ''; // Очищаємо інпут, щоб можна було завантажити той самий файл ще раз
    }
  };

  reader.readAsBinaryString(file);
};

  // Функція для ЗМІНИ СТАТУСУ (код без змін)
  const handleStatusChange = async (id: number, status: string) => {
    try {
      await axios.patch(`/api/soldiers/${id}/status`, { status });
      refetch(); 
    } catch (err) {
      showToast('Помилка оновлення статусу', 'danger');
    }
  };

  // === НОВЕ: Функція для ВИДАЛЕННЯ ===
  const handleDelete = (id: number, name: string) => { // Додаємо 'name' для краси
  ask({
    title: 'Підтвердити Видалення',
    message: `Ви впевнені, що хочете видалити солдата "${name}"? Це також видалить його з графіка.`,

    onConfirm: async () => {
      try {
        await axios.delete(`/api/soldiers/${id}`);
        showToast('Солдата успішно видалено', 'success');
        refetch(); // Оновлюємо список
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Помилка видалення', 'danger');
      }
    }
  });
};

  // === НОВЕ: Функції для Модального Вікна Редагування ===

  // 1. Відкрити вікно і заповнити його даними
  const handleShowEditModal = (soldier: ISoldier) => {
    setEditingSoldier(soldier);
    setEditName(soldier.name);
    setEditRank(soldier.rank);
    setShowEditModal(true);
  };

  // 2. Закрити вікно
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingSoldier(null);
    setEditName('');
    setEditRank('');
  };

  // 3. Відправити оновлені дані
  const handleUpdateSoldier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSoldier) return;

    try {
      await axios.put(`/api/soldiers/${editingSoldier.id}`, {
        name: editName,
        rank: editRank,
      });
      refetch(); // Оновити список
      showToast('Солдата успішно оновлено', 'success');
      handleCloseEditModal(); // Закрити вікно
    } catch (err) {
      showToast('Помилка оновлення', 'danger');
    }
  };

  // Функція для кольору статусу (код без змін)
  const getStatusBadge = (status: string) => {
    // ... (код 'switch(status)...' залишається тут)
    switch(status) {
      case 'ACTIVE': return 'success';
      case 'LEAVE': return 'warning';
      case 'SICK': return 'danger';
      default: return 'secondary';
    }
  }
  // === ФУНКЦІЯ ЗБЕРЕЖЕННЯ ДАНИХ (РЕДАГУВАННЯ) ===
 const handleSubmit = async () => {
    try {
      // ДИВИМОСЬ В КОНСОЛЬ: чи є тут взвод і відділення перед відправкою?
      console.log("Відправляємо дані на сервер:", formData);

      if (editingId) {
        // Якщо ми редагуємо існуючого курсанта
        await axios.put(`/api/soldiers/${editingId}`, formData);
      } else {
        // НОВЕ: Якщо ми створюємо повністю нового курсанта (кнопка "Додати")
        await axios.post('/api/soldiers', formData);
      }
      
      setShowModal(false); // Закриваємо вікно
      
      // Оновлюємо таблицю. Якщо твоя функція називається fetchSoldiers, заміни refetch() на неї:
      refetch(); 
    } catch (error: any) {
      console.error("Помилка збереження:", error);
      alert('Помилка збереження даних. Перевір консоль сервера.');
    }
  };
  // === ФУНКЦІЯ ВІДКРИТТЯ ВІКНА З ДАНИМИ ===
  const openEditModal = (soldier: any) => {
    setEditingId(soldier.id); // Запам'ятовуємо, кого саме редагуємо
    setFormData({
      name: soldier.name,
      rank: soldier.rank,
      position: soldier.position,
      phoneNumber: soldier.phoneNumber || '',
      status: soldier.status,
      platoon: soldier.platoon || '', // Підтягуємо взвод
      squad: soldier.squad || ''      // Підтягуємо відділення
    });
    setShowModal(true); // Відкриваємо вікно
  };

  return (
    <div>
      <hr className="my-4" />
      <h3>Керування особовим складом</h3>

      {/* ФОРМА ДОДАВАННЯ (код без змін) */}
      <Form onSubmit={handleAddSoldier} className="mb-4 p-3 border rounded">
        {/* ... (весь код Row/Col/Form.Control... залишається тут) ... */}
        <Row>
          {/* 1. Поле ПІБ */}
          <Col md={3}>
            <Form.Control 
              type="text" 
              placeholder="ПІБ (напр. Іванов І.І.)" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              required 
            />
          </Col>
          
          {/* 2. Випадаючий список ЗВАННЯ */}
          <Col md={3}>
            <Form.Select 
              value={newRank} 
              onChange={(e) => setNewRank(e.target.value)} 
              required
            >
              <option value="" disabled>Оберіть звання...</option>
              {MILITARY_RANKS.map((r, index) => (
                <option key={index} value={r}>{r}</option>
              ))}
            </Form.Select>
          </Col>

          {/* 3. Випадаючий список ПОСАДА */}
          <Col md={3}>
            <Form.Select 
              value={newPosition} 
              onChange={(e) => setNewPosition(e.target.value)} 
              required
            >
              <option value="" disabled>Оберіть посаду...</option>
              {MILITARY_POSITIONS.map((p, index) => (
                <option key={index} value={p}>{p}</option>
              ))}
            </Form.Select>
          </Col>

          {/* 4. Кнопки */}
          <Col md={3} className="d-flex align-items-end gap-2">
            <Button variant="primary" type="submit" className="w-100">
              Додати
            </Button>
            <Button variant="outline-success" onClick={() => setShowBulkModal(true)} className="w-100 text-nowrap">
              📝 Масовий
            </Button>
          </Col>
        </Row>
        {formError && <Alert variant="danger" className="mt-2">{formError}</Alert>}
      </Form>

      {/* СПИСОК / ТАБЛИЦЯ */}
      {isLoading && <p>Завантаження списку...</p>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Table striped bordered hover responsive>
       <thead>
  <tr>
    <th>#</th>
    <th>ПІБ</th>
    <th>Звання</th>
    <th>Email (Логін)</th> {/* НОВА КОЛОНКА */}
    <th>Статус</th>
    <th>Дії (статус)</th>
    <th>Дії (загальні)</th>
  </tr>
</thead>
        <tbody>
          {soldiers && soldiers.map(soldier => (
            <tr key={soldier.id}>
              <td>{soldier.id}</td>
              <td>{soldier.name}</td>
              {/* ВИВІД ПОШТИ */}
    <td>
      <small className="text-muted" style={{ fontStyle: 'italic' }}>
        {soldier.user?.email || '—'}
      </small>
    </td>
              <td>{soldier.rank}</td>
              <td>
                <Badge bg={getStatusBadge(soldier.status)}>
                  {soldier.status === 'ACTIVE' ? 'В строю' : soldier.status === 'LEAVE' ? 'Відпустка' : 'Хворий'}
                </Badge>
              </td>
              <td>
                <Form.Select 
                  size="sm" 
                  value={soldier.status} 
                  onChange={(e) => handleStatusChange(soldier.id, e.target.value)}
                >
                  <option value="ACTIVE">В строю</option>
                  <option value="LEAVE">Відпустка</option>
                  <option value="SICK">Хворий</option>
                </Form.Select>
              </td>
              {/* === НОВІ КНОПКИ === */}
              <td>
                <Button 
                  variant="warning" 
                  size="sm" 
                  className="me-2"
                  onClick={() => openEditModal(soldier)}
                >
                  Ред.
                </Button>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => handleDelete(soldier.id, soldier.name)}
                >
                  Вид.
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      

     {/* === МОДАЛЬНЕ ВІКНО ДОДАВАННЯ / РЕДАГУВАННЯ ОДНОГО СОЛДАТА === */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Редагувати дані' : 'Додати військовослужбовця'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>ПІБ</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Form.Group>

            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Звання</Form.Label>
                  <Form.Select
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  >
                    <option value="Курсант">Курсант</option>
                    <option value="Старший солдат">Старший солдат</option>
                    <option value="Молодший сержант">Молодший сержант</option>
                    <option value="Сержант">Сержант</option>
                    <option value="Старший сержант">Старший сержант</option>
                    <option value="Офіцер">Офіцер</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Посада</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* НОВИЙ БЛОК: Взвод і Відділення */}
            <Row className="bg-light p-2 rounded mb-3 border">
              <Col>
                <Form.Group>
                  <Form.Label className="text-primary fw-bold">Взвод</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Напр. 11"
                    value={formData.platoon || ''}
                    onChange={(e) => setFormData({ ...formData, platoon: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label className="text-primary fw-bold">Відділення</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Напр. 1"
                    value={formData.squad || ''}
                    onChange={(e) => setFormData({ ...formData, squad: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Статус</Form.Label>
              <Form.Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">В строю</option>
                <option value="SICK">Хворий (Звільнення)</option>
                <option value="LEAVE">У відпустці / Відрядження</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Скасувати
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Зберегти зміни
          </Button>
        </Modal.Footer>
      </Modal>
      
{/* Модальне вікно масового імпорту */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Масовий імпорт курсантів</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* СПОСІБ 1: ЗАВАНТАЖЕННЯ EXCEL */}
          <Alert variant="info">
            <strong>Спосіб 1: Завантажте файл (Excel або CSV)</strong><br/>
            Файл повинен мати заголовки колонок: <b>ПІБ</b>, <b>Звання</b>, <b>Посада</b>.
            <Form.Control 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload} 
              disabled={isImporting}
              className="mt-2 mb-2"
            />
          </Alert>
          
          <hr />

          {/* СПОСІБ 2: ВСТАВКА ТЕКСТУ */}
          <Alert variant="secondary">
            <strong>Спосіб 2: Просто вставте список (лише ПІБ)</strong><br/>
            Усім буде призначено звання і посаду "Курсант".
          </Alert>
          <Form.Control
            as="textarea"
            rows={6}
            placeholder="Шевченко Т.Г.&#10;Франко І.Я.&#10;Леся Українка"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
            Скасувати
          </Button>
          <Button variant="success" onClick={handleBulkImport} disabled={isImporting || !bulkText.trim()}>
            {isImporting ? <Spinner animation="border" size="sm" /> : 'Імпортувати'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};