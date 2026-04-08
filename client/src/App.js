import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import HostsPage from './pages/HostsPage';
import HostDetailPage from './pages/HostDetailPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import api from './utils/api';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" />;
  }
  return children;
}

function MockBanner() {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    api.get('/integration-mode')
      .then(res => setMode(res.data.mode))
      .catch(() => {});
  }, []);

  if (mode !== 'mock') return null;

  return (
    <div className="bg-amber-500 text-black text-center py-1 text-sm font-medium">
      Running in Mock Mode — No emails will be sent
    </div>
  );
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MockBanner />
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/students/:id" element={<StudentDetailPage />} />
                  <Route path="/hosts" element={<HostsPage />} />
                  <Route path="/hosts/:id" element={<HostDetailPage />} />
                  <Route path="/reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
                  <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
