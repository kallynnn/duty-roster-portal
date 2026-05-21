import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.scss';
import './styles.scss';

// Провайдери
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Компоненти
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';

// Сторінки
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { MySchedulePage } from './pages/MySchedulePage';
import { DutyMapPage } from './pages/DutyMapPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Охоронці маршрутів
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Router>
              <div className="d-flex flex-column min-vh-100">
                <Header />

                <main className="flex-grow-1 py-4">
                  <Routes>
                    {/* Публічні маршрути */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Onboarding — захищений, але не потребує ролі */}
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute>
                          <OnboardingPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/contact" element={<ContactPage />} />

                    {/* Захищені маршрути */}
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <MyProfilePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-schedule"
                      element={
                        <ProtectedRoute>
                          <MySchedulePage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Тільки для Командира / Адміна */}
                    <Route
                      path="/dashboard"
                      element={
                        <AdminRoute>
                          <DashboardPage />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/duty-map"
                      element={
                        <AdminRoute>
                          <DutyMapPage />
                        </AdminRoute>
                      }
                    />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </main>

                <Footer />

                {/* Мобільна навігація — показується тільки на екранах < 992px */}
                <BottomNav />
              </div>
            </Router>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;