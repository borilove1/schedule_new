import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';
import { Sun, Moon, Eye, EyeOff } from 'lucide-react';

export default function LoginPage({ onSignupClick }) {
  const { login } = useAuth();
  const { toggleDarkMode } = useTheme();
  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor } = useThemeColors();
  const { inputStyle, labelStyle } = useCommonStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      transition: 'background-color 0.2s'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: cardBg,
        borderRadius: '16px',
        padding: '28px 32px',
        boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.08)',
        transition: 'background-color 0.2s, box-shadow 0.2s'
      }}>
        {/* 다크모드 토글 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={toggleDarkMode}
            style={{
              background: 'none',
              border: 'none',
              color: secondaryTextColor,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>📅</span>
            <h1 style={{ fontSize: '22px', fontWeight: '600', color: textColor, margin: 0 }}>
              업무일정 관리
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: secondaryTextColor, marginTop: '8px' }}>
            로그인하여 시작하세요
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={inputStyle}
              placeholder="email@example.com"
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>비밀번호</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: secondaryTextColor,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <ErrorAlert message={error} />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#1e40af' : '#3B82F6',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          marginTop: '18px',
          textAlign: 'center',
          fontSize: '14px',
          color: secondaryTextColor
        }}>
          계정이 없으신가요?{' '}
          <button
            onClick={onSignupClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#3B82F6',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}
