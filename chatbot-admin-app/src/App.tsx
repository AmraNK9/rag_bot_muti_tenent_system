import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatbotProvider } from './contexts/ChatbotContext';
import { LandingOnboarding } from './components/auth/LandingOnboarding';
import { LoginScreen } from './components/auth/LoginScreen';
import { MainLayout } from './components/layout/MainLayout';

const AppContent: React.FC = () => {
  const { token, loadingProfile } = useAuth();
  const [landingCompleted, setLandingCompleted] = useState<boolean>(() => localStorage.getItem('chatbot_admin_landing_completed') === 'true');

  if (!landingCompleted) {
    return <LandingOnboarding onComplete={() => setLandingCompleted(true)} />;
  }

  if (loadingProfile) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }} />
      </div>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <ChatbotProvider>
      <MainLayout />
    </ChatbotProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
