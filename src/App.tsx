import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { SalesPage } from './pages/SalesPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { StocksPage } from './pages/StocksPage';
import { ReportsPage } from './pages/ReportsPage';
import { ServicesPage } from './pages/ServicesPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route
                  path="sales"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <SalesPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="employees" element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <EmployeesPage />
                  </ProtectedRoute>
                } />
                <Route
                  path="stocks"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <StocksPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="services"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'service']}>
                      <ServicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
