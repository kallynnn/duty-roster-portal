import React, { useState } from 'react';
import { Table, Button, Form, Row, Col, Alert, Modal } from 'react-bootstrap';
import { useFetchData } from '../hooks/useFetchData'; 
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

interface IDutyType {
  id: number;
  name: string;
  description: string | null;
  // Поле зі списком дозволених звань
  allowedRanks: string[]; 
}

// Список звань, які ти можеш обирати (відповідає твоїй формі реєстрації)
const ALL_RANKS = ['солдат', 'ст. солдат', 'сержант', 'ст. сержант', 'курсант'];

export const DutyTypeManager: React.FC = () => {
  const { data: dutyTypes, isLoading, error, refetch } = useFetchData<IDutyType[]>('/api/duty-types');
  const { showToast } = useToast();
  const { ask } = useConfirm();

  // Стани для форми ДОДАВАННЯ
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [newRanks, setNewRanks] = useState<string[]>([]);
  
  // Стани для модального вікна РЕДАГУВАННЯ
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDutyType, setEditingDutyType] = useState<IDutyType | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRanks, setEditRanks] = useState<string[]>([]);

  // --- Обробники ---

  // Обробник зміни чекбоксів для форми ДОДАВАННЯ
  const handleNewRankChange = (rank: string) => {
    setNewRanks(prevRanks => 
      prevRanks.includes(rank)
        ? prevRanks.filter(r => r !== rank) // Видалити
        : [...prevRanks, rank] // Додати
    );
  };

  // Обробник зміни чекбоксів для форми РЕДАГУВАННЯ
  const handleEditRankChange = (rank: string) => {
    setEditRanks(prevRanks => 
      prevRanks.includes(rank)
        ? prevRanks.filter(r => r !== rank)
        : [...prevRanks, rank]
    );
  };
  
  // ДОДАВАННЯ (з 'allowedRanks')
  const handleAddDutyType = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      await axios.post('/api/duty-types', { name, description, allowedRanks: newRanks });
      setName('');
      setDescription('');
      setNewRanks([]); 
      refetch(); 
    } catch (err) {
      setFormError('Помилка додавання. Перевірте поля.');
    }
  };
  
  // ВИДАЛЕННЯ (каскадне)
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

  // ВІДКРИТИ МОДАЛЬНЕ ВІКНО РЕДАГУВАННЯ
  const handleShowEditModal = (dutyType: IDutyType) => {
    setEditingDutyType(dutyType);
    setEditName(dutyType.name);
    setEditDescription(dutyType.description || '');
    setEditRanks(dutyType.allowedRanks.map(r => r.toLowerCase())); // Переводимо в нижній регістр
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingDutyType(null);
    setEditName('');
    setEditDescription('');
    setEditRanks([]);
  };

  // ОНОВИТИ (з 'allowedRanks')
  const handleUpdateDutyType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDutyType) return;

    try {
      await axios.put(`/api/duty-types/${editingDutyType.id}`, {
        name: editName,
        description: editDescription,
        allowedRanks: editRanks, 
      });
      refetch(); 
      showToast('Вид наряду успішно оновлено', 'success');
      handleCloseEditModal(); 
    } catch (err) {
      showToast('Помилка оновлення', 'danger');
    }
  };

  // --- JSX Розмітка ---
  return (
    <div>
      <hr className="my-4" />
      <h3>Керування видами нарядів</h3>
      
      <Form onSubmit={handleAddDutyType} className="mb-4 p-3 border rounded">
        <Row className="align-items-end">
          <Col md={5}>
            <Form.Label>Назва наряду</Form.Label>
            <Form.Control type="text" placeholder="Назва (напр., 'Черговий роти')" value={name} onChange={(e) => setName(e.target.value)} required />
          </Col>
          <Col md={4}>
            <Form.Label>Опис</Form.Label>
            <Form.Control type="text" placeholder="Опис (опціонально)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Col>
          <Col md={3}>
            <Button type="submit" className="w-100">Додати вид</Button>
          </Col>
        </Row>
        
        {/* Чекбокси для звань (Форма ДОДАВАННЯ) */}
        <Form.Group className="mt-3">
          <Form.Label>Дозволені звання (Якщо нічого не обрано - дозволено всім)</Form.Label>
          <div className="d-flex flex-wrap gap-3">
            {ALL_RANKS.map(rank => (
              <Form.Check 
                key={rank}
                type="checkbox"
                label={rank}
                id={`new-${rank}`}
                checked={newRanks.includes(rank)}
                onChange={() => handleNewRankChange(rank)}
              />
            ))}
          </div>
        </Form.Group>
        {formError && <Alert variant="danger" className="mt-2">{formError}</Alert>}
      </Form>

      {isLoading && <p>Завантаження списку...</p>}
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>#</th>
            <th>Назва</th>
            <th>Дозволені звання</th>
            <th>Дії (загальні)</th>
          </tr>
        </thead>
        <tbody>
          {dutyTypes && dutyTypes.map(duty => (
            <tr key={duty.id}>
              <td>{duty.id}</td>
              <td>{duty.name}</td>
              {/* Відображення звань */}
              <td>
                {duty.allowedRanks.length > 0 
                  ? duty.allowedRanks.join(', ') 
                  : <span className="text-muted">Дозволено всім</span>
                }
              </td>
              <td>
                <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowEditModal(duty)}>Ред.</Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(duty.id, duty.name)}>Вид.</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Модальне вікно для Редагування */}
      <Modal show={showEditModal} onHide={handleCloseEditModal}>
         <Modal.Header closeButton>
          <Modal.Title>Редагувати вид наряду</Modal.Title>
         </Modal.Header>
         <Form onSubmit={handleUpdateDutyType}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Назва</Form.Label>
              <Form.Control type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Опис</Form.Label>
              <Form.Control type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </Form.Group>
            
            {/* Чекбокси для звань (Форма РЕДАГУВАННЯ) */}
            <Form.Group className="mt-3">
              <Form.Label>Дозволені звання (Якщо нічого не обрано - дозволено всім)</Form.Label>
              <div className="d-flex flex-wrap gap-3">
                {ALL_RANKS.map(rank => (
                  <Form.Check 
                    key={`edit-${rank}`}
                    type="checkbox"
                    label={rank}
                    id={`edit-${rank}`}
                    checked={editRanks.includes(rank)}
                    onChange={() => handleEditRankChange(rank)}
                  />
                ))}
              </div>
            </Form.Group>
            
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEditModal}>Скасувати</Button>
            <Button variant="primary" type="submit">Зберегти зміни</Button>
          </Modal.Footer>
         </Form>
      </Modal>

    </div>
  );
};