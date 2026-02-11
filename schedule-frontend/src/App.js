import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useThemeColors } from './hooks/useThemeColors';
import { useIsMobile } from './hooks/useIsMobile';
import { useSwipeDown } from './hooks/useSwipeDown';
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
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [cachedEvents, setCachedEvents] = useState([]);
  const [pendingEventId, setPendingEventId] = useState(null);
  const countdownRef = React.useRef(null);
  const isMobile = useIsMobile();

  // 설정/관리자 오버레이
  const [overlayPage, setOverlayPage] = useState(null); // 'settings' | 'admin' | null
  const [overlayAnimating, setOverlayAnimating] = useState(false);
  const [overlayClosing, setOverlayClosing] = useState(false);

  // 로그아웃 시 리셋
  React.useEffect(() => {
    if (!user && !loading) {
      setAuthPage('login');
      setOverlayPage(null);
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

  // 오버레이 열기 (아래에서 위로)
  const openOverlay = useCallback((page) => {
    setOverlayPage(page);
    setOverlayClosing(false);
    requestAnimationFrame(() => setOverlayAnimating(true));
  }, []);

  // 오버레이 닫기 (위에서 아래로)
  const closeOverlay = useCallback(() => {
    if (overlayClosing) return;
    setOverlayClosing(true);
    setOverlayAnimating(false);
    setTimeout(() => {
      setOverlayPage(null);
      setOverlayClosing(false);
    }, 300);
  }, [overlayClosing]);

  // 오버레이 내 페이지 전환 (설정 → 관리자)
  const switchOverlay = useCallback((page) => {
    setOverlayPage(page);
  }, []);

  // 스와이프로 오버레이 닫기 (애니메이션 후 즉시 제거)
  const swipeCloseOverlay = useCallback(() => {
    setOverlayPage(null);
    setOverlayClosing(false);
    setOverlayAnimating(false);
  }, []);
  const { handleTouchStart: overlayTouchStart, handleTouchMove: overlayTouchMove, handleTouchEnd: overlayTouchEnd, swipeStyle: overlaySwipeStyle, backdropOpacity: overlayBackdropOpacity, contentRef: overlayContentRef } = useSwipeDown(swipeCloseOverlay);

  // 알림에서 일정 클릭 시 해당 일정으로 이동
  const handleEventNavigate = (eventId) => {
    setPendingEventId(eventId);
    setOverlayPage(null);
    setOverlayAnimating(false);
    setOverlayClosing(false);
  };

  const { bgColor, textColor } = useThemeColors();

  // 모바일 상태바 색상
  React.useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.content = bgColor;
    }
  }, [bgColor]);

  // ESC로 오버레이 닫기
  useEffect(() => {
    if (!overlayPage) return;
    const handleEsc = (e) => { if (e.key === 'Escape') closeOverlay(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [overlayPage, closeOverlay]);

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
        {/* 캘린더는 항상 렌더링 */}
        <Calendar
          rateLimitCountdown={rateLimitCountdown}
          onRateLimitStart={startRateLimitCountdown}
          cachedEvents={cachedEvents}
          onEventsLoaded={setCachedEvents}
          pendingEventId={pendingEventId}
          onEventOpened={() => setPendingEventId(null)}
          onNavigateSettings={() => openOverlay('settings')}
          onEventNavigate={handleEventNavigate}
        />

        {/* 설정/관리자 오버레이 */}
        {overlayPage && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 950,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backgroundColor: overlaySwipeStyle
              ? `rgba(0,0,0,${0.5 * overlayBackdropOpacity})`
              : (overlayAnimating ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)'),
            transition: overlaySwipeStyle ? 'none' : 'background-color 0.25s ease',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}
          >
            <div
              onTouchStart={overlayTouchStart}
              onTouchMove={overlayTouchMove}
              onTouchEnd={overlayTouchEnd}
              style={{
              backgroundColor: bgColor,
              borderRadius: isMobile ? '20px 20px 0 0' : '16px 16px 0 0',
              width: '100%',
              maxWidth: isMobile ? '100%' : '800px',
              height: isMobile ? 'calc(100% - env(safe-area-inset-top, 0px) - 20px)' : 'calc(100% - 40px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transform: overlaySwipeStyle ? overlaySwipeStyle.transform : (overlayAnimating ? 'translateY(0)' : 'translateY(100%)'),
              transition: overlaySwipeStyle ? overlaySwipeStyle.transition : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}>
              {/* 드래그 핸들 */}
              {isMobile && (
                <div
                  style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '6px', cursor: 'pointer' }}
                  onClick={closeOverlay}
                >
                  <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(150,150,150,0.4)' }} />
                </div>
              )}
              {/* 콘텐츠 스크롤 영역 */}
              <div ref={overlayContentRef} style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '8px 16px 16px' : '24px',
                paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : '24px',
              }}>
                {overlayPage === 'admin' && user.role === 'ADMIN' ? (
                  <AdminPage onBack={() => switchOverlay('settings')} />
                ) : (
                  <SettingsPage
                    onBack={closeOverlay}
                    onNavigateToAdmin={() => switchOverlay('admin')}
                  />
                )}
              </div>
            </div>
          </div>
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
