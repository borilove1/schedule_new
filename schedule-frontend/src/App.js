import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import MainLayout from './components/layout/MainLayout';
import Calendar from './components/calendar/Calendar';

function AppContent() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login'); // 'login' or 'signup'

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#e2e8f0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #334155',
            borderTop: '4px solid #3B82F6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <div>로딩 중...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 인증되지 않은 경우
  if (!user) {
    if (authPage === 'signup') {
      return <SignupPage onBackClick={() => setAuthPage('login')} />;
    }
    return <LoginPage onSignupClick={() => setAuthPage('signup')} />;
  }

  // 인증된 경우
  return (
    <MainLayout>
      <Calendar />
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
