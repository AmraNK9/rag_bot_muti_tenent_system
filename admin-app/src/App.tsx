import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgePage from './pages/KnowledgePage';
import MessagesPage from './pages/MessagesPage';
import './index.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { business, logout } = useAuth();
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🤖</div>
          <span className="sidebar-logo-text">ChatBot Admin</span>
        </div>
        <div className="sidebar-nav">
          <a className="sidebar-link active" href="/">
            <span className="sidebar-link-icon">📊</span> Dashboard
          </a>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {business?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="sidebar-user-name">{business?.name}</div>
              <div className="sidebar-user-role">{business?.plan} plan</div>
            </div>
          </div>
          <button
            id="sidebar-logout"
            className="sidebar-link"
            style={{ color: '#f87171', marginTop: '0.5rem', width: '100%' }}
            onClick={logout}
          >
            <span className="sidebar-link-icon">🚪</span> Sign Out
          </button>
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppShell><DashboardPage /></AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/chatbot/:chatbotId/knowledge"
            element={
              <PrivateRoute>
                <AppShell><KnowledgePage /></AppShell>
              </PrivateRoute>
            }
          />
          <Route
            path="/chatbot/:chatbotId/messages"
            element={
              <PrivateRoute>
                <AppShell><MessagesPage /></AppShell>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
