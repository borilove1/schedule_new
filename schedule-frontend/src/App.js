import React, { useState, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useThemeColors } from './hooks/useThemeColors';
import { useIsMobile } from './hooks/useIsMobile';
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
  const isMobile = useIsMobile();
  const touchRef = useRef(null);

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

  // 모바일 스와이프 뒤로가기 (설정/관리자 페이지에서 오른쪽 스와이프)
  const handleSwipeStart = useCallback((e) => {
    if (!isMobile) return;
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [isMobile]);

  const handleSwipeEnd = useCallback((e) => {
    if (!isMobile || !touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    // 오른쪽 스와이프 80px 이상 + 가로가 세로보다 클 때
    if (dx > 80 && Math.abs(dx) > Math.abs(dy)) {
      if (currentPage === 'admin') {
        setCurrentPage('settings');
      } else if (currentPage === 'settings') {
        setCurrentPage('calendar');
      }
    }
  }, [isMobile, currentPage]);

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

  // 인증된 경우
  return (
    <NotificationProvider>
      <MainLayout>
        {currentPage === 'admin' && user.role === 'ADMIN' ? (
          <div onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
            <AdminPage onBack={() => setCurrentPage('settings')} />
          </div>
        ) : currentPage === 'settings' ? (
          <div onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
            <SettingsPage
              onBack={() => setCurrentPage('calendar')}
              onNavigateToAdmin={() => setCurrentPage('admin')}
            />
          </div>
        ) : (
          <Calendar
            rateLimitCountdown={rateLimitCountdown}
            onRateLimitStart={startRateLimitCountdown}
            cachedEvents={cachedEvents}
            onEventsLoaded={setCachedEvents}
            pendingEventId={pendingEventId}
            onEventOpened={() => setPendingEventId(null)}
            onNavigateSettings={() => setCurrentPage('settings')}
            onEventNavigate={handleEventNavigate}
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
