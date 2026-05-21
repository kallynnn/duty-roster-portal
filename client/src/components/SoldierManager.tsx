import React, { useState, useMemo } from 'react';
import {
  Accordion, Badge, Button, Card, Col, Form,
  InputGroup, Modal, Row, Spinner, Alert
} from 'react-bootstrap';
import { useFetchData } from '../hooks/useFetchData';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  MILITARY_RANKS, MILITARY_POSITIONS,
  SOLDIER_STATUS, SOLDIER_STATUS_LABELS, SoldierStatus
} from '../utils/constants';
import * as XLSX from 'xlsx';

interface ISoldier {
  id: number;
  name: string;
  rank: string;
  position: string;
  status: SoldierStatus;
  platoon?: string | null;
  squad?: string | null;
  phoneNumber?: string;
  user?: { email: string };
}

// ── Групуємо: platoon → squad → soldier[]
function groupSoldiers(soldiers: ISoldier[]) {
  const map: Record<string, Record<string, ISoldier[]>> = {};
  for (const s of soldiers) {
    const pl = s.platoon?.trim() || 'Без взводу';
    const sq = s.squad?.trim()  || 'Без відділення';
    if (!map[pl]) map[pl] = {};
    if (!map[pl][sq]) map[pl][sq] = [];
    map[pl][sq].push(s);
  }
  return map;
}

function platoonStats(squads: Record<string, ISoldier[]>) {
  const all = Object.values(squads).flat();
  return {
    total:  all.length,
    active: all.filter(s => s.status === SOLDIER_STATUS.ACTIVE).length,
    sick:   all.filter(s => s.status === SOLDIER_STATUS.SICK).length,
    leave:  all.filter(s => s.status === SOLDIER_STATUS.LEAVE).length,
  };
}

export const SoldierManager: React.FC = () => {
  const { data: soldiers, isLoading, error, refetch } = useFetchData<ISoldier[]>('/api/soldiers');
  const { showToast } = useToast();
  const { ask }       = useConfirm();

  // ── Пошук / фільтр ──
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<SoldierStatus | ''>('');

  // ── Модалка редагування/додавання ──
  const [showModal, setShowModal]     = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [formData, setFormData]       = useState({
    name: '', rank: 'Солдат', position: 'Курсант',
    phoneNumber: '', status: 'ACTIVE', platoon: '', squad: '',
  });

  // ── Масовий імпорт ──
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText]           = useState('');
  const [bulkPlatoon, setBulkPlatoon]     = useState('');
  const [bulkCompany, setBulkCompany]     = useState('');
  const [isImporting, setIsImporting]     = useState(false);

  // ── Фільтрація ──
  const filtered = useMemo(() => {
    if (!soldiers) return [];
    return soldiers.filter(s => {
      const matchName   = s.name.toLowerCase().includes(search.toLowerCase().trim());
      const matchStatus = !statusFilter || s.status === statusFilter;
      return matchName && matchStatus;
    });
  }, [soldiers, search, statusFilter]);

  const grouped  = useMemo(() => groupSoldiers(filtered), [filtered]);
  const platoons = useMemo(() => Object.keys(grouped).sort((a, b) => {
    if (a === 'Без взводу') return 1;
    if (b === 'Без взводу') return -1;
    return a.localeCompare(b, 'uk');
  }), [grouped]);

  // ── CRUD ──
  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: '', rank: 'Солдат', position: 'Курсант', phoneNumber: '', status: 'ACTIVE', platoon: '', squad: '' });
    setShowModal(true);
  };

  const openEdit = (s: ISoldier) => {
    setEditingId(s.id);
    setFormData({
      name: s.name, rank: s.rank, position: s.position,
      phoneNumber: s.phoneNumber || '', status: s.status,
      platoon: s.platoon || '', squad: s.squad || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return showToast('Введіть ПІБ', 'warning');
    try {
      if (editingId) {
        await axios.put(`/api/soldiers/${editingId}`, formData);
        showToast('Дані збережено', 'success');
      } else {
        await axios.post('/api/soldiers', formData);
        showToast('Військовослужбовця додано', 'success');
      }
      setShowModal(false);
      refetch();
    } catch {
      showToast('Помилка збереження', 'danger');
    }
  };

  const handleDelete = (id: number, name: string) => {
    ask({
      title: 'Підтвердити видалення',
      message: `Видалити "${name}"? Це видалить його з графіка.`,
      onConfirm: async () => {
        try {
          await axios.delete(`/api/soldiers/${id}`);
          showToast('Видалено', 'success');
          refetch();
        } catch {
          showToast('Помилка видалення', 'danger');
        }
      },
    });
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await axios.patch(`/api/soldiers/${id}/status`, { status });
      refetch();
    } catch {
      showToast('Помилка зміни статусу', 'danger');
    }
  };

  // ── Масовий імпорт (текст) ──
  const handleBulkImport = async () => {
    if (!bulkText.trim())    return showToast('Введіть список імен', 'warning');
    if (!bulkPlatoon.trim()) return showToast('Вкажіть номер взводу', 'warning');
    setIsImporting(true);
    try {
      const res = await axios.post('/api/soldiers/bulk', {
        text:    bulkText,
        platoon: bulkPlatoon.trim(),
        company: bulkCompany.trim() || undefined,
      });
      showToast(res.data.message, 'success');
      setBulkText(''); setBulkPlatoon(''); setBulkCompany('');
      setShowBulkModal(false);
      refetch();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Помилка імпорту', 'danger');
    } finally { setIsImporting(false); }
  };

  // ── Excel ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb   = XLSX.read(evt.target?.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const res  = await axios.post('/api/soldiers/import-excel', { soldiers: data });
        showToast(res.data.message, 'success');
        refetch();
        setShowBulkModal(false);
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Помилка читання файлу', 'danger');
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const totalAll = soldiers?.length ?? 0;

  return (
    <div>
      <hr className="my-4" />

      {/* ── Заголовок + кнопки ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="mb-0">Керування особовим складом</h3>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={openAdd}>+ Додати</Button>
          <Button variant="outline-success" size="sm" onClick={() => setShowBulkModal(true)}>📝 Масовий</Button>
        </div>
      </div>

      {/* ── Пошук / фільтр ── */}
      <Row className="g-2 mb-3">
        <Col xs={12} sm={6} md={7}>
          <InputGroup>
            <InputGroup.Text>🔍</InputGroup.Text>
            <Form.Control
              placeholder="Пошук за ПІБ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="outline-secondary" onClick={() => setSearch('')}>✕</Button>
            )}
          </InputGroup>
        </Col>
        <Col xs={8} sm={4} md={3}>
          <Form.Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SoldierStatus | '')}>
            <option value="">Всі статуси</option>
            <option value={SOLDIER_STATUS.ACTIVE}>В строю</option>
            <option value={SOLDIER_STATUS.LEAVE}>Відпустка</option>
            <option value={SOLDIER_STATUS.SICK}>Хворий</option>
          </Form.Select>
        </Col>
        <Col xs={4} sm={2} className="d-flex align-items-center">
          <small className="text-muted text-nowrap">
            {filtered.length} з {totalAll}
          </small>
        </Col>
      </Row>

      {isLoading && <div className="text-center py-4"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}

      {/* ── Ієрархічний акордеон ── */}
      {!isLoading && !error && filtered.length === 0 && (
        <Alert variant="light" className="text-center text-muted">
          {search || statusFilter ? 'Нікого не знайдено за заданими фільтрами' : 'Список порожній'}
        </Alert>
      )}

      <Accordion alwaysOpen defaultActiveKey={platoons}>
        {platoons.map(platoon => {
          const squads = grouped[platoon];
          const stats  = platoonStats(squads);
          return (
            <Accordion.Item key={platoon} eventKey={platoon} className="mb-2 border rounded overflow-hidden">
              <Accordion.Header>
                <div className="d-flex flex-wrap align-items-center gap-2 w-100 me-2">
                  <span className="fw-bold fs-6">{platoon}</span>
                  <Badge bg="secondary">{stats.total} ос.</Badge>
                  {stats.active > 0 && <Badge bg="success">{stats.active} в строю</Badge>}
                  {stats.sick   > 0 && <Badge bg="danger">{stats.sick} хвор.</Badge>}
                  {stats.leave  > 0 && <Badge bg="warning" text="dark">{stats.leave} відп.</Badge>}
                </div>
              </Accordion.Header>

              <Accordion.Body className="p-2 p-md-3">
                {Object.keys(squads).sort((a, b) => {
                  if (a === 'Без відділення') return 1;
                  if (b === 'Без відділення') return -1;
                  return a.localeCompare(b, 'uk');
                }).map(squad => (
                  <div key={squad} className="mb-4">
                    {/* Заголовок відділення */}
                    <div className="d-flex align-items-center gap-2 mb-2 ps-2 border-start border-3 border-primary">
                      <span className="fw-semibold text-primary">{squad}</span>
                      <Badge bg="light" text="dark" className="border">
                        {squads[squad].length} ос.
                      </Badge>
                    </div>

                    {/* Картки солдатів */}
                    <Row className="g-2">
                      {squads[squad].map(soldier => (
                        <Col key={soldier.id} xs={12} sm={6} lg={4} xxl={3}>
                          <Card className="h-100 shadow-sm border-0 bg-body-tertiary">
                            <Card.Body className="p-2 p-md-3">

                              {/* Ім'я + статус-бейдж */}
                              <div className="d-flex justify-content-between align-items-start gap-1 mb-1">
                                <div className="fw-semibold lh-sm" style={{ fontSize: '0.88rem' }}>
                                  {soldier.name}
                                </div>
                                <Badge
                                  bg={soldier.status === SOLDIER_STATUS.ACTIVE ? 'success'
                                    : soldier.status === SOLDIER_STATUS.SICK ? 'danger' : 'warning'}
                                  text={soldier.status === SOLDIER_STATUS.LEAVE ? 'dark' : undefined}
                                  className="text-nowrap flex-shrink-0"
                                  style={{ fontSize: '0.7rem' }}
                                >
                                  {SOLDIER_STATUS_LABELS[soldier.status]}
                                </Badge>
                              </div>

                              {/* Звання / email */}
                              <div className="text-muted mb-2" style={{ fontSize: '0.76rem' }}>
                                <div>{soldier.rank}</div>
                                {soldier.user?.email && (
                                  <div className="text-truncate" title={soldier.user.email}>
                                    {soldier.user.email}
                                  </div>
                                )}
                              </div>

                              {/* Зміна статусу + кнопки */}
                              <div className="d-flex gap-1">
                                <Form.Select
                                  size="sm"
                                  value={soldier.status}
                                  onChange={e => handleStatusChange(soldier.id, e.target.value)}
                                  style={{ flex: '1 1 0', minWidth: 0 }}
                                >
                                  <option value={SOLDIER_STATUS.ACTIVE}>В строю</option>
                                  <option value={SOLDIER_STATUS.LEAVE}>Відпустка</option>
                                  <option value={SOLDIER_STATUS.SICK}>Хворий</option>
                                </Form.Select>
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={() => openEdit(soldier)}
                                  title="Редагувати"
                                  style={{ padding: '0.2rem 0.45rem' }}
                                >✏️</Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDelete(soldier.id, soldier.name)}
                                  title="Видалити"
                                  style={{ padding: '0.2rem 0.45rem' }}
                                >🗑️</Button>
                              </div>

                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>

      {/* ── Модалка додавання / редагування ── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Редагувати дані' : 'Додати військовослужбовця'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>ПІБ</Form.Label>
              <Form.Control
                placeholder="Іванов Іван Іванович"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </Form.Group>

            <Row className="g-2 mb-3">
              <Col xs={6}>
                <Form.Label>Звання</Form.Label>
                <Form.Select value={formData.rank} onChange={e => setFormData({ ...formData, rank: e.target.value })}>
                  {MILITARY_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </Form.Select>
              </Col>
              <Col xs={6}>
                <Form.Label>Посада</Form.Label>
                <Form.Select value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })}>
                  {MILITARY_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </Form.Select>
              </Col>
            </Row>

            <Row className="g-2 mb-3">
              <Col xs={6}>
                <Form.Label className="text-primary fw-semibold">Взвод</Form.Label>
                <Form.Control
                  placeholder="напр. 1 Взвод"
                  value={formData.platoon}
                  onChange={e => setFormData({ ...formData, platoon: e.target.value })}
                />
              </Col>
              <Col xs={6}>
                <Form.Label className="text-primary fw-semibold">Відділення</Form.Label>
                <Form.Control
                  placeholder="напр. 1 Відділення"
                  value={formData.squad}
                  onChange={e => setFormData({ ...formData, squad: e.target.value })}
                />
              </Col>
            </Row>

            <Row className="g-2">
              <Col xs={6}>
                <Form.Label>Телефон</Form.Label>
                <Form.Control
                  placeholder="+380..."
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </Col>
              <Col xs={6}>
                <Form.Label>Статус</Form.Label>
                <Form.Select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  <option value={SOLDIER_STATUS.ACTIVE}>В строю</option>
                  <option value={SOLDIER_STATUS.LEAVE}>Відпустка</option>
                  <option value={SOLDIER_STATUS.SICK}>Хворий</option>
                </Form.Select>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Скасувати</Button>
          <Button variant="primary" onClick={handleSave}>Зберегти</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Модалка масового імпорту ── */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Масовий імпорт курсантів</Modal.Title>
        </Modal.Header>
        <Modal.Body>

          {/* Спосіб 1: Excel */}
          <Alert variant="info" className="mb-3">
            <strong>Спосіб 1: Excel / CSV файл</strong><br />
            <span className="text-muted small">Колонки: <b>ПІБ</b>, <b>Звання</b> (необов'язково)</span>
            <Form.Control
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="mt-2"
            />
          </Alert>

          <hr />

          {/* Спосіб 2: Текстовий список */}
          <div className="mb-2">
            <strong>Спосіб 2: Список ПІБ (по одному на рядок)</strong>
            <p className="text-muted small mb-2">
              Email буде сформовано автоматично: <code>прізвище{'{'}взвод{'}'}</code>@viti.edu.ua<br />
              Пароль за замовчуванням: <b>viti2026</b>
            </p>
          </div>

          <Row className="g-2 mb-2">
            <Col xs={6}>
              <Form.Label className="small fw-semibold">Взвод *</Form.Label>
              <Form.Control
                placeholder="напр. 221"
                value={bulkPlatoon}
                onChange={e => setBulkPlatoon(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Form.Label className="small fw-semibold">Рота (необов'язково)</Form.Label>
              <Form.Control
                placeholder="напр. 21"
                value={bulkCompany}
                onChange={e => setBulkCompany(e.target.value)}
              />
            </Col>
          </Row>

          <Form.Control
            as="textarea"
            rows={6}
            placeholder={"Атабаєв Олексій Анатолійович\nВащик Олександр Анатолійович\nВойтенко Андрій Романович"}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />
          {bulkText && bulkPlatoon && (
            <div className="text-muted small mt-1">
              Приклад email: <code>{bulkText.trim().split('\n')[0].trim().split(' ')[0].toLowerCase()}{bulkPlatoon}@viti.edu.ua</code>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>Скасувати</Button>
          <Button variant="success" onClick={handleBulkImport} disabled={isImporting || !bulkText.trim() || !bulkPlatoon.trim()}>
            {isImporting ? <Spinner animation="border" size="sm" /> : 'Імпортувати'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
