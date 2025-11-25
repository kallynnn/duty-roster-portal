import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

export const AboutPage: React.FC = () => {
  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={10}>
          <Card className="shadow-sm">
            <Card.Body className="p-4 p-md-5">
              <h2 className="text-center mb-4">Про проєкт "DutyPortal"</h2>

              <p className="lead">
                Цей веб-портал є курсовим проєктом з дисципліни "Веб-технології та веб-дизайн".
              </p>

              <hr className="my-4" />

              <h4>Мета проєкту</h4>
              <p>
                Метою проєкту є розробка повноцінного Full-Stack веб-додатку для автоматизації 
                процесу призначення, контролю та звітності щодо добових нарядів військовослужбовців.
              </p>

              <h4>Основні функції</h4>
              <ul>
                <li><strong>Керування особовим складом:</strong> Додавання, редагування, видалення та зміна статусу (В строю, Відпустка, Хворий).</li>
                <li><strong>Керування видами нарядів:</strong> Створення нарядів та встановлення обмежень за званнями (напр., "Черговий роти" - тільки для сержантів).</li>
                <li><strong>Автоматична генерація графіку:</strong> "Розумний" алгоритм (V5), який заповнює графік на місяць вперед, враховуючи обмеження за званням та 4-денний "кулдаун" (відпочинок).</li>
                <li><strong>Розподіл ролей:</strong>
                  <ul>
                    <li><strong>Командир:</strong> Має доступ до повної "Панелі управління" для керування системою.</li>
                    <li><strong>Солдат:</strong> Бачить тільки свій особистий графік ("Мій Графік") та загальну інформацію.</li>
                  </ul>
                </li>
                <li><strong>Інтерактивний календар:</strong> Відображення графіку з можливістю перегляду деталей по кожному дню.</li>
                <li><strong>Динамічна статистика:</strong> Відображення загальної або особистої статистики нарядів (за 7/30/365 днів).</li>
                <li><strong>Сучасний UI:</strong> Адаптивний дизайн з підтримкою світлої/темної теми.</li>
              </ul>

              <hr className="my-4" />

              <h4>Використані технології</h4>
              <ul className="list-inline">
                <li className="list-inline-item"><span className="badge bg-primary">React</span></li>
                <li className="list-inline-item"><span className="badge bg-info text-dark">TypeScript</span></li>
                <li className="list-inline-item"><span className="badge bg-secondary">Node.js</span></li>
                <li className="list-inline-item"><span className="badge bg-dark">Express.js</span></li>
                <li className="list-inline-item"><span className="badge bg-success">PostgreSQL</span></li>
                <li className="list-inline-item"><span className="badge bg-primary-subtle text-dark">Prisma (ORM)</span></li>
                <li className="list-inline-item"><span className="badge bg-purple" style={{ backgroundColor: '#7952B3', color: 'white' }}>Bootstrap</span></li>
                <li className="list-inline-item"><span className="badge bg-danger-subtle text-dark">SCSS</span></li>
                <li className="list-inline-item"><span className="badge bg-warning text-dark">JWT</span></li>
              </ul>

            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};