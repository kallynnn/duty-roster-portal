import React from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import { useToast } from '../context/ToastContext';

export const ContactPage: React.FC = () => {
  const { showToast } = useToast();
  return (
    <Container>
      <h2 className="my-4">Контакти</h2>
      
      <Row>
        {/* === Колонка з картою === */}
        <Col md={7}>
          <h4>Наша адреса</h4>
          <p>Тут можна вказати адресу, телефон, email...</p>
          
          <div className="map-responsive">
            
            {/* === ОСЬ ТУТ ТВІЙ КОД === */}
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1736.0475244570216!2d30.542199769521726!3d50.42976866149797!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40d4cf0c044dd735%3A0x77940fa521b6fd28!2z0JLQvtC10L3QvdGL0Lkg0LjQvdGB0YLQuNGC0YPRgiDRgtC10LvQtdC60L7QvNC80YPQvdC40LrQsNGG0LjQuSDQuCDQuNC90YTQvtGA0LzQsNGC0LjQt9Cw0YbQuNC4INC40LzQtdC90Lgg0JPQtdGA0L7QtdCyINCa0YDRg9GC!5e0!3m2!1sru!2sde!4v1762112260646!5m2!1sru!2sde" 
              width="100%" 
              height="450" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            {/* === КІНЕЦЬ ТВОГО КОДУ === */}
            
          </div>
        </Col>
        
        {/* === Колонка з формою зворотного зв'язку === */}
        <Col md={5}>
          <h4>Зворотний зв'язок</h4>
          <Form onSubmit={(e) => {
            e.preventDefault();
            showToast('Форма ще не підключена, але верстка готова!', 'info');
          }}>
            <Form.Group className="mb-3" controlId="contactForm.Name">
              <Form.Label>Ваше ім'я</Form.Label>
              <Form.Control type="text" placeholder="Ім'я" required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="contactForm.Email">
              <Form.Label>Email адреса</Form.Label>
              <Form.Control type="email" placeholder="name@example.com" required />
            </Form.Group>
            <Form.Group className="mb-3" controlId="contactForm.Message">
              <Form.Label>Ваше повідомлення</Form.Label>
              <Form.Control as="textarea" rows={5} required />
            </Form.Group>
            <Button variant="primary" type="submit">
              Відправити
            </Button>
          </Form>
        </Col>
      </Row>
    </Container>
  );
};