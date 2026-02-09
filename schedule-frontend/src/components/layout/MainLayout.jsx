import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Sun, Moon, LogOut, Shield, User } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

export default function MainLayout({ children, currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  const { toggleDarkMode } = useTheme();
  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const isMobile = useIsMobile();

  return (
    <div className="app-shell" style={{ backgroundColor: bgColor, color: textColor, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        padding: isMobile ? '6px 16px' : '8px 24px',
        borderBottom: `1px solid ${borderColor}`,
        backgroundColor: cardBg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          <span style={{ fontSize: isMobile ? '20px' : '28px', lineHeight: 1 }}>📅</span>
          <h1 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '600', margin: 0 }}>
            업무일정 관리
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px' }}>
          {!isMobile && user && (
            <button
              onClick={() => onNavigate('profile')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'right',
                marginRight: '8px',
                padding: '4px 8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              title="내 정보 수정"
            >
              <div style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>
                {user.division} {user.office}
              </div>
              <div style={{ fontSize: '13px', color: secondaryTextColor }}>
                {user.department} {user.position} {user.name}님
              </div>
            </button>
          )}

          {isMobile && (
            <button
              onClick={() => onNavigate('profile')}
              style={{
                background: 'none',
                border: 'none',
                color: currentPage === 'profile' ? '#3B82F6' : textColor,
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="내 정보"
            >
              <User size={20} />
            </button>
          )}

          <button
            onClick={toggleDarkMode}
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <NotificationBell />

          {user && user.role === 'ADMIN' && (
            <button
              onClick={() => onNavigate(currentPage === 'admin' ? 'calendar' : 'admin')}
              style={{
                background: 'none',
                border: 'none',
                color: currentPage === 'admin' ? '#3B82F6' : textColor,
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center'
              }}
              title={currentPage === 'admin' ? '캘린더로 돌아가기' : '관리자 페이지'}
            >
              <Shield size={20} />
            </button>
          )}

          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="로그아웃"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Mobile User Info */}
      {isMobile && user && (
        <div style={{
          padding: '6px 16px',
          backgroundColor: cardBg,
          borderBottom: `1px solid ${borderColor}`,
          fontSize: '13px'
        }}>
          <div style={{ fontWeight: '500' }}>
            {user.division} {user.office}
          </div>
          <div style={{ color: secondaryTextColor }}>
            {user.department} {user.position} {user.name}님
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
