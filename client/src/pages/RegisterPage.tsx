import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom'; 
import axios from 'axios'; 
import { MILITARY_RANKS, MILITARY_POSITIONS } from '../utils/constants';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [name, setName] = useState(''); 
  const [rank, setRank] = useState(''); // Звання
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [position, setPosition] = useState(''); // Посада

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate(); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== passwordConfirmation) {
      setError('Паролі не збігаються');
      return; 
    }
    
    // Перевірка, чи обрано звання (як ти просив, звання - випадаючий)
    if (rank === "") {
      setError('Будь ласка, оберіть ваше звання');
      return;
    }

    try {
      const registerData = {
        email,
        password,
        passwordConfirmation,
        name,
        rank, // <-- Звання (з випадаючого списку)
        phoneNumber,
        position // <-- Посада (з текстового поля)
      };

      const response = await axios.post(
        '/api/auth/register', 
        registerData
      );

      setSuccess(response.data.message + " Ви будете перенаправлені на сторінку входу.");
      
      setEmail('');
      setPassword('');
      setPasswordConfirmation('');
      setName('');
      setRank('');
      setPhoneNumber('');
      setPosition(''); 

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Помилка реєстрації');
      } else {
        setError('Невідома помилка');
      }
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center mt-5">
        <Col md={6}>
          <h2 className="text-center mb-4">Реєстрація</h2>
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formBasicName">
              <Form.Label>ПІБ (Прізвище І.Б.)</Form.Label>
              <Form.Control
                type="text"
                placeholder="напр., Новіков М.М."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

           {/* ЗАМІНИТИ ПОЛЕ ЗВАННЯ НА ЦЕ: */}
<Form.Group className="mb-3">
  <Form.Label>Звання</Form.Label>
  <Form.Select 
    value={rank} 
    onChange={(e) => setRank(e.target.value)}
    required
  >
    <option value="" disabled>Оберіть звання...</option>
    {MILITARY_RANKS.map((r, index) => (
      <option key={index} value={r}>{r}</option>
    ))}
  </Form.Select>
</Form.Group>

            {/* ЗАМІНИТИ ПОЛЕ ПОСАДИ НА ЦЕ: */}
<Form.Group className="mb-3">
  <Form.Label>Посада</Form.Label>
  <Form.Select 
    value={position} 
    onChange={(e) => setPosition(e.target.value)}
    required
  >
    <option value="" disabled>Оберіть посаду...</option>
    {MILITARY_POSITIONS.map((p, index) => (
      <option key={index} value={p}>{p}</option>
    ))}
  </Form.Select>
</Form.Group>
            
            <Form.Group className="mb-3" controlId="formBasicPhone">
              <Form.Label>Номер телефону</Form.Label>
              <Form.Control
                type="tel"
                placeholder="+380..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </Form.Group>
            
            <hr />

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
              <Form.Label>Пароль (мін. 6 символів)</Form.Label>
              <Form.Control
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicPasswordConfirm">
              <Form.Label>Повторіть пароль</Form.Label>
              <Form.Control
                type="password"
                placeholder="Повторіть пароль"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                minLength={6}
              />
            </Form.Group>
            
            {error && <Alert variant="danger">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <div className="d-grid">
              <Button variant="primary" type="submit">
                Зареєструватися
              </Button>
            </div>
          </Form>

          <div className="text-center mt-3">
            <p>Вже є акаунт? <Link to="/login">Увійти</Link></p>
          </div>
        </Col>
      </Row>
    </Container>
  );
};