import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggleButton } from './ThemeToggleButton';
// === НОВЕ: Імпортуємо компоненти Navbar, Nav, Container ===
import { Navbar, Nav, Container, Button } from 'react-bootstrap';

export const Header: React.FC = () => {
  const { isAuthenticated, logout, role } = useAuth();

  return (
    // expand="lg" означає: на великих екранах меню розгорнуте, на менших - "бургер"
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="p-3">
      <Container>
        {/* Логотип */}
        <Navbar.Brand as={NavLink} to="/">
          DutyPortal
        </Navbar.Brand>

        {/* Кнопка "Бургер" (з'являється тільки на мобільних) */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        {/* Все, що всередині Collapse, буде ховатися в меню */}
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto gap-2">
            <Nav.Link as={NavLink} to="/">Головна</Nav.Link>
            <Nav.Link as={NavLink} to="/about">Про сайт</Nav.Link>
            
            {isAuthenticated && (
              <Nav.Link as={NavLink} to="/profile">Мій Профіль</Nav.Link>
            )}
            
            <Nav.Link as={NavLink} to="/news">Новини</Nav.Link>
            <Nav.Link as={NavLink} to="/contact">Контакти</Nav.Link>
          </Nav>

          {/* Права частина (Кнопки + Тема) */}
          <div className="d-flex gap-2 align-items-center mt-3 mt-lg-0">
            {isAuthenticated ? (
              <>
                {(role === 'COMMANDER' || role === 'ADMIN') ? (
                  <Link to="/dashboard" className="btn btn-primary btn-sm">
                    Панель управління
                  </Link>
                ) : (
                  <Link to="/my-schedule" className="btn btn-primary btn-sm">
                    Мій Графік
                  </Link>
                )}
                
                <Button variant="outline-light" size="sm" onClick={logout}>
                  Вийти
                </Button>
              </>
            ) : (
              <Link to="/login" className="btn btn-outline-light btn-sm">
                Увійти
              </Link>
            )}
            
            <div className="ms-2">
               <ThemeToggleButton />
            </div>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};