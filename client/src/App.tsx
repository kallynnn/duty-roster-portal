import React from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';
import { MySchedulePage } from './pages/MySchedulePage';

// 1. Імпортуємо наші компоненти
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// 2. Імпортуємо наші сторінки
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { NewsPage } from './pages/NewsPage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';

// 3. Імпортуємо стилі (які ми перейменували)
import './App.scss';

function App() {
  return (
    // 4. Ініціалізуємо BrowserRouter, який слідкує за URL
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100"> {/* Допоміжний клас, щоб футер був "прибитий" донизу */}

        {/* 5. Header відображається завжди */}
        <Header />

        {/* 6. Контент сторінки (буде змінюватись) */}
        <main className="container my-4 flex-grow-1">
          <Routes>
            {/* 7. Налаштовуємо маршрути */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <MyProfilePage />
          </ProtectedRoute>
        } 
      />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route 
 path="/dashboard" 
  element={
    <AdminRoute>
      <DashboardPage />
    </AdminRoute>
  }
/>        {/* (Пізніше тут будуть /login, /dashboard тощо) */}
<Route 
    path="/my-schedule" 
    element={
      <ProtectedRoute>
        <MySchedulePage />
      </ProtectedRoute>
    } 
  />
</Routes>
            
          
        </main>

        {/* 8. Footer відображається завжди */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;