import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <Container className="mt-5">
      <Row className="justify-content-center text-center">
        <Col md={6}>
          {/* Велика цифра */}
          <div style={{ fontSize: '8rem', fontWeight: 900, lineHeight: 1, color: '#dee2e6' }}>
            404
          </div>

          <h2 className="mb-3">Сторінку не знайдено</h2>
          <p className="text-muted mb-4">
            Схоже, такої сторінки не існує або вона була переміщена.
            Перевірте адресу або поверніться на головну.
          </p>

          <div className="d-flex gap-3 justify-content-center">
            <Button as={Link as any} to="/" variant="primary">
              🏠 На головну
            </Button>
            <Button variant="outline-secondary" onClick={() => window.history.back()}>
              ← Назад
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
};