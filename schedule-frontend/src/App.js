import React, { useState, useCallback, useRef } from 'react';
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
import SettingsPage from './components/settings/SettingsPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');
  const [currentPage, setCurrentPage] = useState('calendar');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [cachedEvents, setCachedEvents] = useState([]);
  const [pendingEventId, setPendingEventId] = useState(null);
  const countdownRef = React.useRef(null);

  // 페이지 전환 애니메이션
  const [pageTransition, setPageTransition] = useState('none'); // 'fade-out' | 'none'
  const transitionTimerRef = useRef(null);

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

  // 페이지 전환 (페이드 애니메이션)
  const navigateTo = useCallback((targetPage) => {
    if (transitionTimerRef.current) return;
    setPageTransition('fade-out');
    transitionTimerRef.current = setTimeout(() => {
      setCurrentPage(targetPage);
      setPageTransition('none');
      transitionTimerRef.current = null;
    }, 200);
  }, []);

  // 알림에서 일정 클릭 시 해당 일정으로 이동
  const handleEventNavigate = (eventId) => {
    setPendingEventId(eventId);
    setCurrentPage('calendar');
  };

  const { bgColor, textColor } = useThemeColors();

  // 모바일 상태바 색상
  React.useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.content = bgColor;
    }
  }, [bgColor]);

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

  // 페이지 전환 스타일
  const transitionStyle = pageTransition === 'fade-out'
    ? { opacity: 0, transform: 'scale(0.98)', transition: 'opacity 200ms ease-out, transform 200ms ease-out' }
    : { opacity: 1, transform: 'scale(1)', transition: 'opacity 200ms ease-in, transform 200ms ease-in' };

  // 인증된 경우
  return (
    <NotificationProvider>
      <MainLayout>
        <div style={transitionStyle}>
          {currentPage === 'admin' && user.role === 'ADMIN' ? (
            <AdminPage onBack={() => navigateTo('settings')} />
          ) : currentPage === 'settings' ? (
            <SettingsPage
              onBack={() => navigateTo('calendar')}
              onNavigateToAdmin={() => navigateTo('admin')}
            />
          ) : (
            <Calendar
              rateLimitCountdown={rateLimitCountdown}
              onRateLimitStart={startRateLimitCountdown}
              cachedEvents={cachedEvents}
              onEventsLoaded={setCachedEvents}
              pendingEventId={pendingEventId}
              onEventOpened={() => setPendingEventId(null)}
              onNavigateSettings={() => navigateTo('settings')}
              onEventNavigate={handleEventNavigate}
            />
          )}
        </div>
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
