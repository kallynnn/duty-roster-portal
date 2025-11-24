import React, { useState, useEffect } from 'react';
// === НОВЕ: Імпортуємо Modal ===
import { Table, Button, Form, Row, Col, Alert, Badge, Modal } from 'react-bootstrap';
import { useFetchData } from '../hooks/useFetchData';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

interface ISoldier {
  id: number;
  name: string;
  rank: string;
  status: 'ACTIVE' | 'LEAVE' | 'SICK';
}

export const SoldierManager: React.FC = () => {
  const { data: soldiers, isLoading, error, refetch } = useFetchData<ISoldier[]>('/api/soldiers');
  const { showToast } = useToast();
  const { ask } = useConfirm();

  // Стани для форми додавання
  const [newName, setNewName] = useState('');
  const [newRank, setNewRank] = useState('');
  const [formError, setFormError] = useState('');

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
      await axios.post('/api/soldiers', { name: newName, rank: newRank });
      setNewName('');
      setNewRank('');
      refetch(); 
    } catch (err) {
      setFormError('Помилка додавання. Перевірте поля.');
    }
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

  return (
    <div>
      <hr className="my-4" />
      <h3>Керування особовим складом</h3>

      {/* ФОРМА ДОДАВАННЯ (код без змін) */}
      <Form onSubmit={handleAddSoldier} className="mb-4 p-3 border rounded">
        {/* ... (весь код Row/Col/Form.Control... залишається тут) ... */}
        <Row>
          <Col md={5}>
            <Form.Control 
              type="text" 
              placeholder="ПІБ" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              required 
            />
          </Col>
          <Col md={4}>
            <Form.Control 
              type="text" 
              placeholder="Звання" 
              value={newRank} 
              onChange={(e) => setNewRank(e.target.value)} 
              required 
            />
          </Col>
          <Col md={3}>
            <Button type="submit" className="w-100">Додати солдата</Button>
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
                  onClick={() => handleShowEditModal(soldier)}
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

      {/* === НОВЕ: МОДАЛЬНЕ ВІКНО РЕДАГУВАННЯ === */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
        <Modal.Header closeButton>
          <Modal.Title>Редагувати дані солдата</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdateSoldier}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>ПІБ</Form.Label>
              <Form.Control
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Звання</Form.Label>
              <Form.Control
                type="text"
                value={editRank}
                onChange={(e) => setEditRank(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Скасувати
            </Button>
            <Button variant="primary" type="submit">
              Зберегти зміни
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </div>
  );
};