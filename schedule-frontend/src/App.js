import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useThemeColors } from './hooks/useThemeColors';
import LoadingSpinner from './components/common/LoadingSpinner';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import MainLayout from './components/layout/MainLayout';
import Calendar from './components/calendar/Calendar';
import AdminPage from './components/admin/AdminPage';
import ProfilePage from './components/profile/ProfilePage';

function AppContent() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');
  const [currentPage, setCurrentPage] = useState('calendar');
  const [calendarKey, setCalendarKey] = useState(0);

  // 로그아웃 시 로그인 페이지로 리셋
  React.useEffect(() => {
    if (!user && !loading) {
      setAuthPage('login');
      setCurrentPage('calendar');
    }
  }, [user, loading]);

  // 홈으로 이동 (캘린더 + 이번 달로 리셋)
  const handleGoHome = () => {
    setCurrentPage('calendar');
    setCalendarKey(k => k + 1);
  };

  const { bgColor, textColor } = useThemeColors();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor
      }}>
        <LoadingSpinner message="로딩 중..." />
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
    <NotificationProvider>
      <MainLayout currentPage={currentPage} onNavigate={setCurrentPage} onGoHome={handleGoHome}>
        {currentPage === 'admin' && user.role === 'ADMIN' ? (
          <AdminPage />
        ) : currentPage === 'profile' ? (
          <ProfilePage onBack={() => setCurrentPage('calendar')} />
        ) : (
          <Calendar key={calendarKey} />
        )}
      </MainLayout>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
