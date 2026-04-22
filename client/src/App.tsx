import React from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from './components/AdminRoute';

// 1. Імпортуємо наші компоненти
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// 2. Імпортуємо наші сторінки
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { ContactPage } from './pages/ContactPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';

// 3. Імпортуємо стилі
import './App.scss';

function App() {
  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100">
        <Header />

        <main className="container my-4 flex-grow-1">
          {/* УСІ МАРШРУТИ МАЮТЬ БУТИ ВСЕРЕДИНІ <Routes> */}
          <Routes>
           <Route 
  path="/" 
  element={
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  } 
/>
            <Route path="/about" element={<AboutPage />} />
            
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <MyProfilePage />
                </ProtectedRoute>
              } 
            />
            
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
            />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;