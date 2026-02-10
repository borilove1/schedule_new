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
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [cachedEvents, setCachedEvents] = useState([]);
  const [pendingEventId, setPendingEventId] = useState(null);
  const countdownRef = React.useRef(null);

  // 로그아웃 시 로그인 페이지로 리셋
  React.useEffect(() => {
    if (!user && !loading) {
      setAuthPage('login');
      setCurrentPage('calendar');
    }
  }, [user, loading]);

  // Rate limit 카운트다운 정리
  React.useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const startRateLimitCountdown = React.useCallback((seconds) => {
    if (countdownRef.current) return;
    setRateLimitCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setRateLimitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 홈으로 이동 (캘린더 + 이번 달로 리셋)
  const handleGoHome = () => {
    setCurrentPage('calendar');
    setCalendarKey(k => k + 1);
  };

  // 알림에서 일정 클릭 시 해당 일정으로 이동
  const handleEventNavigate = (eventId) => {
    setPendingEventId(eventId);
    setCurrentPage('calendar');
  };

  const { isDarkMode, bgColor, cardBg, textColor } = useThemeColors();

  // 모바일 상태바 색상: 로그인 전=배경색, 로그인 후=헤더색
  React.useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.content = user ? cardBg : bgColor;
    }
  }, [user, cardBg, bgColor]);

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
      <MainLayout currentPage={currentPage} onNavigate={setCurrentPage} onGoHome={handleGoHome} onEventNavigate={handleEventNavigate}>
        {currentPage === 'admin' && user.role === 'ADMIN' ? (
          <AdminPage />
        ) : currentPage === 'profile' ? (
          <ProfilePage onBack={() => setCurrentPage('calendar')} />
        ) : (
          <Calendar
            key={calendarKey}
            rateLimitCountdown={rateLimitCountdown}
            onRateLimitStart={startRateLimitCountdown}
            cachedEvents={cachedEvents}
            onEventsLoaded={setCachedEvents}
            pendingEventId={pendingEventId}
            onEventOpened={() => setPendingEventId(null)}
          />
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
