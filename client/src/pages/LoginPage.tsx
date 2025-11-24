import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom'; // 1. Імпортуємо 'useNavigate'
import axios from 'axios'; // 2. Імпортуємо 'axios'
import { useAuth } from '../context/AuthContext'; // 3. Імпортуємо наш "хук"

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // Для відображення помилок

  const navigate = useNavigate(); // 4. Ініціалізуємо навігацію
  const { login } = useAuth(); // 5. Дістаємо функцію 'login' з нашого Контексту

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Зупиняємо стандартну відправку форми
    setError(''); // Скидаємо помилку

    try {
      // 6. Робимо РЕАЛЬНИЙ запит до нашого Backend
      const response = await axios.post(
        '/api/auth/login',
        { email, password }
      );

      // 7. Якщо логін успішний, backend поверне нам токен та роль
      const { token, role } = response.data;

      // 8. Викликаємо функцію 'login' з Контексту, щоб зберегти токен
      login(token, role);

      // 9. Перенаправляємо користувача на Головну сторінку
      navigate('/');

    } catch (err: any) {
      // 10. Якщо Backend повернув помилку (400), вона буде в 'err.response.data'
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Помилка входу');
      } else {
        setError('Щось пішло не так');
      }
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center mt-5">
        <Col md={6}>
          <h2 className="text-center mb-4">Увійти в систему</h2>

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Email адреса</Form.Label>
              <Form.Control
                type="email"
                placeholder="Введіть email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicPassword">
              <Form.Label>Пароль</Form.Label>
              <Form.Control
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            {/* Повідомлення про помилку */}
            {error && <Alert variant="danger">{error}</Alert>}

            <div className="d-grid">
              <Button variant="primary" type="submit">
                Увійти
              </Button>
            </div>
          </Form>

          <div className="text-center mt-3">
            <p>Немає акаунту? <Link to="/register">Зареєструватися</Link></p>
          </div>
        </Col>
      </Row>
    </Container>
  );
};