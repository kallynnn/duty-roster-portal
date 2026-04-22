import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Badge, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';
import axios from 'axios';

export const MyProfilePage: React.FC = () => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMyProfile = async () => {
      try {
        const response = await axios.get('/api/schedule/my');
        setProfileData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Помилка завантаження профілю');
      } finally {
        setLoading(false);
      }
    };
    fetchMyProfile();
  }, []);

  if (loading) return <Container className="mt-5 text-center"><Spinner animation="border" /></Container>;
  if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

  const { soldier, schedules, isCommander, commandLevel, subordinatesSchedules } = profileData;

  return (
    <Container className="mt-4">
      <h2 className="mb-4">Особистий кабінет</h2>
      
      <Row>
        {/* ЛІВА КОЛОНКА: Власна інформація */}
        <Col md={isCommander ? 4 : 12} className="mb-4">
          <Card className="shadow-sm border-0 mb-4">
            <Card.Body>
              <Card.Title className="fs-4">{soldier.name}</Card.Title>
              <Card.Subtitle className="mb-2 text-muted">
                {soldier.rank} | {soldier.position}
              </Card.Subtitle>
              <div className="mt-3">
                {soldier.platoon && <Badge bg="secondary" className="me-2">Взвод: {soldier.platoon}</Badge>}
                {soldier.squad && <Badge bg="secondary">Відділення: {soldier.squad}</Badge>}
              </div>
            </Card.Body>
          </Card>

          <h5 className="mb-3">Мої чергування:</h5>
          {schedules.length === 0 ? (
            <Alert variant="success">Нарядів не заплановано. Відпочивайте! ☕</Alert>
          ) : (
            <ListGroup className="shadow-sm">
              {schedules.map((item: any) => {
                const dateObj = new Date(item.date);
                const isToday = dateObj.toDateString() === new Date().toDateString();
                return (
                  <ListGroup.Item key={item.id} className={isToday ? 'bg-danger text-white p-3' : 'p-3'}>
                    <h6 className="mb-1">{item.dutyType.name}</h6>
                    <small className={isToday ? 'text-light' : 'text-muted'}>
                      {dateObj.toLocaleDateString('uk-UA', { weekday: 'short', day: '2-digit', month: 'long' })}
                    </small>
                    {isToday && <Badge bg="light" text="danger" className="float-end">СЬОГОДНІ</Badge>}
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </Col>

        {/* ПРАВА КОЛОНКА: Командирська панель (Тільки для командирів) */}
        {isCommander && (
          <Col md={8}>
            <Card className="shadow-sm border-primary">
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">🛡️ Командирська панель ({commandLevel})</h5>
              </Card.Header>
              <Card.Body>
                <Card.Title>Графік нарядів підлеглого особового складу</Card.Title>
                
                {subordinatesSchedules.length === 0 ? (
                  <Alert variant="info" className="mt-3">Підлеглі найближчим часом у наряд не заступають.</Alert>
                ) : (
                  <div className="table-responsive mt-3" style={{ maxHeight: '500px' }}>
                    <Table hover size="sm">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Дата</th>
                          <th>Військовослужбовець</th>
                          <th>Наряд</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subordinatesSchedules.map((item: any) => (
                          <tr key={item.id} className={new Date(item.date).toDateString() === new Date().toDateString() ? 'table-warning' : ''}>
                            <td className="text-nowrap">{new Date(item.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}</td>
                            <td><strong>{item.soldier.name}</strong> <br/><small className="text-muted">{item.soldier.rank}</small></td>
                            <td>{item.dutyType.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </Container>
  );
};