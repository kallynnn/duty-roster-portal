import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggleButton } from './ThemeToggleButton';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';

export const Header: React.FC = () => {
  const { isAuthenticated, logout, role } = useAuth();
  const isCommander = role === 'COMMANDER' || role === 'ADMIN';

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="p-3">
      <Container>
        <Navbar.Brand as={NavLink} to="/" style={{ fontWeight: 700, letterSpacing: '-0.3px' }}>
          DutyPortal
        </Navbar.Brand>

        <div className="header-actions-mobile ms-auto">
          <ThemeToggleButton />
          {isAuthenticated && (
            <Button variant="outline-light" size="sm" onClick={logout}>Вийти</Button>
          )}
          {!isAuthenticated && (
            <Link to="/login" className="btn btn-outline-light btn-sm">Увійти</Link>
          )}
        </div>

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto gap-2 header-nav-links">
            <Nav.Link as={NavLink} to="/">Головна</Nav.Link>
            <Nav.Link as={NavLink} to="/about">Про сайт</Nav.Link>
            {isAuthenticated && (
              <Nav.Link as={NavLink} to="/profile">Мій Профіль</Nav.Link>
            )}
            {isCommander && (
              <Nav.Link as={NavLink} to="/duty-map">Карта чергувань</Nav.Link>
            )}
            <Nav.Link as={NavLink} to="/contact">Контакти</Nav.Link>
          </Nav>

          <div className="header-actions-full d-flex gap-2 align-items-center">
            {isAuthenticated ? (
              <>
                {isCommander ? (
                  <Link to="/dashboard" className="btn btn-primary btn-sm">Панель управління</Link>
                ) : (
                  <Link to="/my-schedule" className="btn btn-primary btn-sm">Мій Графік</Link>
                )}
                <Button variant="outline-light" size="sm" onClick={logout}>Вийти</Button>
              </>
            ) : (
              <Link to="/login" className="btn btn-outline-light btn-sm">Увійти</Link>
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