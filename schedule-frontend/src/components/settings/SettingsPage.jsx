import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useNotification } from '../../contexts/NotificationContext';
import {
  X, User, Lock, Sun, Moon, Mail, Bell, Shield, LogOut,
  ChevronRight, ChevronDown, Save, CheckCircle
} from 'lucide-react';
import ErrorAlert from '../common/ErrorAlert';
import ConfirmDialog from '../common/ConfirmDialog';
import api from '../../utils/api';
import { subscribeToPush, unsubscribeFromPush, getPushPermissionState } from '../../utils/pushHelper';

// ── 커스텀 드롭다운 ──
function CustomSelect({ value, onChange, options, placeholder, disabled, colors, dropUp, maxItems }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const ref = useRef(null);
  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor, inputBg } = colors;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(o => o.value === value);
      setFocusedIdx(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && focusedIdx >= 0 && focusedIdx < options.length) {
        onChange(options[focusedIdx].value);
        setIsOpen(false);
      } else {
        setIsOpen(!isOpen);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setFocusedIdx(prev => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setFocusedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Tab') {
      if (isOpen) setIsOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: '100%', padding: '12px', borderRadius: '12px',
          border: `1px solid ${(isOpen || isFocused) ? '#3B82F6' : borderColor}`,
          backgroundColor: disabled ? (isDarkMode ? '#1a1a2e' : '#f3f4f6') : inputBg,
          color: value ? textColor : secondaryTextColor,
          fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', paddingRight: '36px', position: 'relative',
          boxShadow: (isOpen || isFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.6 : 1, outline: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={16} style={{
          position: 'absolute', right: '12px', top: '50%',
          color: secondaryTextColor,
          transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
          transition: 'transform 0.2s',
        }} />
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute', left: 0, right: 0, zIndex: 10,
          ...(dropUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
          borderRadius: '12px', border: `1px solid ${borderColor}`,
          backgroundColor: cardBg,
          boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
          overflow: 'hidden', maxHeight: maxItems ? `${maxItems * 40}px` : '200px', overflowY: 'auto',
        }}>
          {options.map((opt, idx) => (
            <div key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: textColor,
                backgroundColor: idx === focusedIdx
                  ? (isDarkMode ? '#1e293b' : '#f0f9ff')
                  : value === opt.value ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
              }}
              onMouseEnter={(e) => {
                setFocusedIdx(idx);
                if (value !== opt.value) e.target.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                if (idx !== focusedIdx && value !== opt.value) e.target.style.backgroundColor = 'transparent';
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 토글 스위치 ──
function ToggleSwitch({ checked, onChange, disabled, isDarkMode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      style={{
        width: '48px', height: '26px', borderRadius: '13px',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
        backgroundColor: checked ? '#3B82F6' : (isDarkMode ? '#475569' : '#cbd5e1'),
        transition: 'background-color 0.2s', flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%',
        backgroundColor: '#fff', position: 'absolute', top: '3px',
        left: checked ? '25px' : '3px', transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ── 메인 설정 페이지 ──
export default function SettingsPage({ onBack, onNavigateToAdmin }) {
  const { user, updateProfile, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const colors = useThemeColors();
  const { cardBg, textColor, secondaryTextColor, borderColor } = colors;
  const { inputStyle, labelStyle } = useCommonStyles();
  const isMobile = useIsMobile();
  const { pushSupported, pushSubscribed, setPushSubscribed } = useNotification();

  const [expandedSection, setExpandedSection] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── 프로필 수정 상태 ──
  const [profileData, setProfileData] = useState({
    name: '', position: '', division: '', office: '', department: ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [organizations, setOrganizations] = useState({ divisions: [], offices: {}, departments: {} });

  // ── 비밀번호 변경 상태 ──
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', newPasswordConfirm: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── 이메일 알림 상태 ──
  const [emailPrefs, setEmailPrefs] = useState({
    emailNotificationsEnabled: false,
    emailPreferences: {
      EVENT_REMINDER: true, EVENT_UPDATED: true, EVENT_COMPLETED: true,
      EVENT_DELETED: true, USER_REGISTERED: true, ACCOUNT_APPROVED: true,
    }
  });
  const [emailPrefsOriginal, setEmailPrefsOriginal] = useState(null);
  const [systemEmailEnabled, setSystemEmailEnabled] = useState(false);
  const [emailPrefsLoading, setEmailPrefsLoading] = useState(false);
  const [emailPrefsError, setEmailPrefsError] = useState('');
  const [emailPrefsSuccess, setEmailPrefsSuccess] = useState('');

  // ── 푸시 알림 상태 ──
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '', position: user.position || '',
        division: user.division || '', office: user.office || '',
        department: user.department || ''
      });
    }
  }, [user]);

  useEffect(() => {
    const loadEmailPrefs = async () => {
      try {
        const data = await api.getEmailPreferences();
        setSystemEmailEnabled(!!data.systemEmailEnabled);
        const prefs = {
          emailNotificationsEnabled: data.emailNotificationsEnabled,
          emailPreferences: data.emailPreferences || {}
        };
        setEmailPrefs(prefs);
        setEmailPrefsOriginal(prefs);
      } catch (error) {
        console.error('Failed to load email preferences:', error);
      }
    };
    loadEmailPrefs();
  }, []);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const data = await api.request('/organizations/structure');
        setOrganizations(data.organization || data);
      } catch (error) {
        console.error('Failed to load organizations:', error);
      }
    };
    loadOrganizations();
  }, []);

  // ── 프로필 로직 ──
  const availableOffices = profileData.division ? (organizations.offices[profileData.division] || []) : [];
  const availableDepartments = profileData.office ? (organizations.departments[profileData.office] || []) : [];

  const getPositionOptions = () => {
    const deptName = profileData.department || '';
    const officeName = profileData.office || '';
    if (deptName.includes('직할') || officeName.includes('직할')) {
      if (deptName.includes('본부') || officeName.includes('본부')) return [{ value: '본부장', label: '본부장' }];
      if (deptName.includes('처') || officeName.includes('처')) return [{ value: '처장', label: '처장' }];
      if (deptName.includes('실') || officeName.includes('실')) return [{ value: '실장', label: '실장' }];
      if (deptName.includes('지사') || officeName.includes('지사')) return [{ value: '지사장', label: '지사장' }];
      return [{ value: '본부장', label: '본부장' }];
    }
    if (deptName) {
      return [
        { value: '부장', label: '부장' }, { value: '차장', label: '차장' },
        { value: '과장', label: '과장' }, { value: '대리', label: '대리' }, { value: '사원', label: '사원' },
      ];
    }
    if (officeName) {
      const options = [];
      if (officeName.includes('실')) options.push({ value: '실장', label: '실장' });
      else if (officeName.includes('처')) options.push({ value: '처장', label: '처장' });
      else options.push({ value: '지사장', label: '지사장' });
      options.push(
        { value: '부장', label: '부장' }, { value: '차장', label: '차장' },
        { value: '과장', label: '과장' }, { value: '대리', label: '대리' }, { value: '사원', label: '사원' },
      );
      return options;
    }
    return [];
  };

  const positionOptions = getPositionOptions();
  const divisionOptions = organizations.divisions.map(d => {
    const name = typeof d === 'string' ? d : d.name;
    return { value: name, label: name };
  });
  const officeOptions = availableOffices.map(o => {
    const name = typeof o === 'string' ? o : o.name;
    return { value: name, label: name };
  });
  const departmentOptions = availableDepartments.map(d => {
    const name = typeof d === 'string' ? d : d.name;
    return { value: name, label: name };
  });

  const handleCustomChange = (name, value) => {
    if (name === 'division') setProfileData(prev => ({ ...prev, division: value, office: '', department: '', position: '' }));
    else if (name === 'office') setProfileData(prev => ({ ...prev, office: value, department: '', position: '' }));
    else if (name === 'department') setProfileData(prev => ({ ...prev, department: value, position: '' }));
    else setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError(''); setProfileSuccess(''); setProfileLoading(true);
    try {
      await updateProfile(profileData);
      setProfileSuccess('정보가 수정되었습니다.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.message || '정보 수정에 실패했습니다.');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── 비밀번호 로직 ──
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError(''); setPasswordSuccess('');
    if (passwordData.newPassword.length < 8) {
      setPasswordError('새 비밀번호는 최소 8자 이상이어야 합니다.'); return;
    }
    // eslint-disable-next-line no-useless-escape
    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(passwordData.newPassword)) {
      setPasswordError('새 비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.'); return;
    }
    if (passwordData.newPassword !== passwordData.newPasswordConfirm) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.'); return;
    }
    setPasswordLoading(true);
    try {
      await api.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess('비밀번호가 변경되었습니다.');
      setPasswordData({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── 이메일 로직 ──
  const handleEmailPrefsSave = async () => {
    setEmailPrefsLoading(true); setEmailPrefsError(''); setEmailPrefsSuccess('');
    try {
      await api.updateEmailPreferences(emailPrefs);
      setEmailPrefsOriginal({ ...emailPrefs });
      setEmailPrefsSuccess('이메일 알림 설정이 저장되었습니다.');
      setTimeout(() => setEmailPrefsSuccess(''), 3000);
    } catch (err) {
      setEmailPrefsError(err.message || '설정 저장에 실패했습니다.');
    } finally {
      setEmailPrefsLoading(false);
    }
  };
  const emailPrefsHasChanges = emailPrefsOriginal && JSON.stringify(emailPrefs) !== JSON.stringify(emailPrefsOriginal);

  const NOTIFICATION_TYPE_LABELS = {
    EVENT_REMINDER: '일정 알림 (마감 임박)', EVENT_UPDATED: '일정 수정 알림',
    EVENT_COMPLETED: '일정 완료 알림', EVENT_DELETED: '일정 삭제 알림',
    USER_REGISTERED: '사용자 가입 알림', ACCOUNT_APPROVED: '계정 승인 알림',
  };

  // ── 푸시 로직 ──
  const handlePushToggle = async () => {
    if (pushLoading) return;
    setPushLoading(true); setPushError('');
    try {
      if (pushSubscribed) {
        const success = await unsubscribeFromPush();
        if (success) setPushSubscribed(false);
      } else {
        const success = await subscribeToPush();
        setPushSubscribed(success);
        if (!success) {
          const perm = getPushPermissionState();
          setPushError(perm === 'denied'
            ? '브라우저에서 알림이 차단되었습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.'
            : '푸시 알림 등록에 실패했습니다. 잠시 후 다시 시도해주세요.'
          );
        }
      }
    } catch {
      setPushError('푸시 알림 처리 중 오류가 발생했습니다.');
    } finally {
      setPushLoading(false);
    }
  };

  // ── 아코디언 토글 ──
  const toggleSection = useCallback((id) => {
    setExpandedSection(prev => prev === id ? null : id);
  }, []);

  // ── 스타일 ──
  const successStyle = {
    padding: '10px 16px', borderRadius: '8px', backgroundColor: '#10b98120',
    color: '#10b981', fontSize: '13px', marginBottom: '16px',
    display: 'flex', alignItems: 'center', gap: '8px',
  };

  const btnStyle = {
    padding: '10px 24px', borderRadius: '8px', border: 'none',
    backgroundColor: '#3B82F6', color: '#fff', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
  };

  // ── 메뉴 항목 렌더 ──
  const menuItems = [
    { id: 'profile', label: '내 정보 수정', icon: User, desc: `${user?.email || ''} / ${user?.role === 'ADMIN' ? '관리자' : user?.role === 'DEPT_LEAD' ? '부서장' : '일반 사용자'}` },
    { id: 'password', label: '비밀번호 변경', icon: Lock, desc: '계정 보안 관리' },
    { id: 'theme', label: '테마 변경', icon: isDarkMode ? Moon : Sun, desc: isDarkMode ? '다크 모드' : '라이트 모드' },
    { id: 'email', label: '이메일 알림 설정', icon: Mail, desc: '이메일 알림 수신 관리' },
    { id: 'push', label: '푸시 알림 설정', icon: Bell, desc: '브라우저/모바일 푸시 알림' },
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor, margin: 0 }}>
          설정
        </h2>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: secondaryTextColor,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '8px',
          }}
          title="닫기"
        >
          <X size={22} />
        </button>
      </div>

      {/* 메뉴 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isExpanded = expandedSection === item.id;
          return (
            <div key={item.id} style={{
              backgroundColor: cardBg, borderRadius: '12px',
              border: `1px solid ${isExpanded ? '#3B82F6' : borderColor}`,
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* 메뉴 버튼 */}
              <button
                onClick={() => toggleSection(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '14px', padding: isMobile ? '14px 16px' : '16px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: textColor, textAlign: 'left',
                }}
              >
                <Icon size={20} style={{ color: isExpanded ? '#3B82F6' : secondaryTextColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '500' }}>{item.label}</div>
                  {item.desc && (
                    <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                  )}
                </div>
                {isExpanded
                  ? <ChevronDown size={18} style={{ color: secondaryTextColor, flexShrink: 0 }} />
                  : <ChevronRight size={18} style={{ color: secondaryTextColor, flexShrink: 0 }} />
                }
              </button>

              {/* 아코디언 내용 */}
              <div style={{
                display: 'grid',
                gridTemplateRows: isExpanded ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.3s ease-in-out',
              }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    padding: isMobile ? '0 16px 16px' : '0 20px 20px',
                    borderTop: `1px solid ${borderColor}`,
                  }}>
                    {item.id === 'profile' && renderProfileSection()}
                    {item.id === 'password' && renderPasswordSection()}
                    {item.id === 'theme' && renderThemeSection()}
                    {item.id === 'email' && renderEmailSection()}
                    {item.id === 'push' && renderPushSection()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* 관리자 (ADMIN 전용) */}
        {user?.role === 'ADMIN' && (
          <button
            onClick={onNavigateToAdmin}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: '14px', padding: isMobile ? '14px 16px' : '16px 20px',
              backgroundColor: cardBg, borderRadius: '12px',
              border: `1px solid ${borderColor}`, cursor: 'pointer',
              color: textColor, textAlign: 'left',
            }}
          >
            <Shield size={20} style={{ color: secondaryTextColor, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '500' }}>관리자</div>
              <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '2px' }}>사용자 관리, 조직 관리, 시스템 설정</div>
            </div>
            <ChevronRight size={18} style={{ color: secondaryTextColor, flexShrink: 0 }} />
          </button>
        )}

        {/* 로그아웃 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', background: 'none', border: 'none',
              cursor: 'pointer', color: secondaryTextColor, fontSize: '13px',
              borderRadius: '8px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = secondaryTextColor}
          >
            <LogOut size={15} />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* 로그아웃 확인 다이얼로그 */}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="로그아웃"
          message="정말 로그아웃하시겠습니까?"
          actions={[
            { label: '로그아웃', variant: 'danger', onClick: () => { setShowLogoutConfirm(false); logout(); } },
          ]}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );

  // ──────────────────────────────────────────
  // 섹션 렌더 함수들
  // ──────────────────────────────────────────

  function renderProfileSection() {
    return (
      <div style={{ paddingTop: '16px' }}>
        {profileSuccess && (
          <div style={successStyle}><CheckCircle size={16} /> {profileSuccess}</div>
        )}
        <ErrorAlert message={profileError} />

        <form onSubmit={handleProfileSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>이름</label>
            <input type="text" value={profileData.name}
              onChange={e => setProfileData(prev => ({ ...prev, name: e.target.value }))}
              required style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>본부</label>
            <CustomSelect value={profileData.division}
              onChange={(val) => handleCustomChange('division', val)}
              options={divisionOptions} placeholder="선택하세요" colors={colors}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>처</label>
            <CustomSelect value={profileData.office}
              onChange={(val) => handleCustomChange('office', val)}
              options={officeOptions} placeholder="선택하세요"
              disabled={!profileData.division} colors={colors} maxItems={4}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>부서{availableDepartments.length > 0 ? '' : ' (해당 없음)'}</label>
            <CustomSelect value={profileData.department}
              onChange={(val) => handleCustomChange('department', val)}
              options={departmentOptions}
              placeholder={availableDepartments.length > 0 ? '선택하세요' : '해당 없음'}
              disabled={!profileData.office || availableDepartments.length === 0}
              colors={colors} maxItems={4}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>직급</label>
            <CustomSelect value={profileData.position}
              onChange={(val) => handleCustomChange('position', val)}
              options={positionOptions}
              placeholder={
                !profileData.office ? '소속을 먼저 선택하세요'
                  : (availableDepartments.length > 0 && !profileData.department) ? '부서를 먼저 선택하세요'
                    : positionOptions.length > 0 ? '선택하세요' : '소속을 먼저 선택하세요'
              }
              disabled={!profileData.office || (availableDepartments.length > 0 && !profileData.department) || positionOptions.length === 0}
              colors={colors} maxItems={4}
            />
          </div>

          <button type="submit" disabled={profileLoading}
            style={{ ...btnStyle, opacity: profileLoading ? 0.7 : 1 }}>
            <Save size={16} /> {profileLoading ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>
    );
  }

  function renderPasswordSection() {
    return (
      <div style={{ paddingTop: '16px' }}>
        {passwordSuccess && (
          <div style={successStyle}><CheckCircle size={16} /> {passwordSuccess}</div>
        )}
        <ErrorAlert message={passwordError} />

        <form onSubmit={handlePasswordSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>현재 비밀번호</label>
            <input type="password" value={passwordData.currentPassword}
              onChange={e => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              required style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>새 비밀번호</label>
            <input type="password" value={passwordData.newPassword}
              onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              required minLength={8} style={inputStyle}
              placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>새 비밀번호 확인</label>
            <input type="password" value={passwordData.newPasswordConfirm}
              onChange={e => setPasswordData(prev => ({ ...prev, newPasswordConfirm: e.target.value }))}
              required minLength={8}
              style={{
                ...inputStyle,
                borderColor: passwordData.newPasswordConfirm && passwordData.newPassword !== passwordData.newPasswordConfirm
                  ? '#ef4444' : borderColor
              }}
            />
            {passwordData.newPasswordConfirm && passwordData.newPassword !== passwordData.newPasswordConfirm && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>비밀번호가 일치하지 않습니다.</div>
            )}
          </div>
          <button type="submit" disabled={passwordLoading}
            style={{ ...btnStyle, opacity: passwordLoading ? 0.7 : 1 }}>
            <Lock size={16} /> {passwordLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    );
  }

  function renderThemeSection() {
    return (
      <div style={{ paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>
              {isDarkMode ? '다크 모드' : '라이트 모드'}
            </div>
            <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '2px' }}>
              화면 테마를 변경합니다.
            </div>
          </div>
          <ToggleSwitch checked={isDarkMode} onChange={toggleDarkMode} isDarkMode={isDarkMode} />
        </div>
      </div>
    );
  }

  function renderEmailSection() {
    return (
      <div style={{ paddingTop: '16px' }}>
        {!systemEmailEnabled ? (
          <div style={{
            padding: '14px 16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            border: `1px solid ${borderColor}`, color: secondaryTextColor,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Mail size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>이메일 알림 기능이 현재 비활성화 상태입니다. 관리자가 시스템 설정에서 이메일 알림을 활성화한 후 사용할 수 있습니다.</span>
          </div>
        ) : (
          <>
            {emailPrefsSuccess && (
              <div style={successStyle}><CheckCircle size={16} /> {emailPrefsSuccess}</div>
            )}
            <ErrorAlert message={emailPrefsError} />

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: emailPrefs.emailNotificationsEnabled ? '20px' : '0',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>이메일 알림 받기</div>
                <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '2px' }}>
                  이벤트 발생 시 이메일로 알림을 수신합니다.
                </div>
              </div>
              <ToggleSwitch
                checked={emailPrefs.emailNotificationsEnabled}
                onChange={() => setEmailPrefs(prev => ({ ...prev, emailNotificationsEnabled: !prev.emailNotificationsEnabled }))}
                isDarkMode={isDarkMode}
              />
            </div>

            {emailPrefs.emailNotificationsEnabled && (
              <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '16px' }}>
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0',
                  }}>
                    <span style={{ fontSize: '14px', color: textColor }}>{label}</span>
                    <button type="button"
                      onClick={() => setEmailPrefs(prev => ({
                        ...prev, emailPreferences: { ...prev.emailPreferences, [type]: !prev.emailPreferences[type] }
                      }))}
                      style={{
                        width: '44px', height: '24px', borderRadius: '12px',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        backgroundColor: emailPrefs.emailPreferences[type] ? '#3B82F6' : (isDarkMode ? '#475569' : '#cbd5e1'),
                        transition: 'background-color 0.2s', flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: '#fff', position: 'absolute', top: '3px',
                        left: emailPrefs.emailPreferences[type] ? '23px' : '3px', transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={handleEmailPrefsSave}
              disabled={emailPrefsLoading || !emailPrefsHasChanges}
              style={{
                ...btnStyle, marginTop: '16px',
                opacity: (emailPrefsLoading || !emailPrefsHasChanges) ? 0.5 : 1,
                cursor: (emailPrefsLoading || !emailPrefsHasChanges) ? 'not-allowed' : 'pointer',
              }}>
              <Save size={16} /> {emailPrefsLoading ? '저장 중...' : '저장'}
            </button>
          </>
        )}
      </div>
    );
  }

  function renderPushSection() {
    return (
      <div style={{ paddingTop: '16px' }}>
        {!pushSupported ? (
          <div style={{
            padding: '14px 16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            border: `1px solid ${borderColor}`, color: secondaryTextColor,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Bell size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>이 브라우저에서는 푸시 알림을 지원하지 않습니다.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>푸시 알림 받기</div>
                <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '2px' }}>
                  PC에서는 브라우저 알림, 모바일에서는 푸시 알림을 받을 수 있습니다.
                </div>
              </div>
              <ToggleSwitch
                checked={pushSubscribed}
                onChange={handlePushToggle}
                disabled={pushLoading}
                isDarkMode={isDarkMode}
              />
            </div>

            {pushError && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                fontSize: '12px', lineHeight: '1.5',
                backgroundColor: isDarkMode ? '#1e293b' : '#fef2f2',
                border: `1px solid ${isDarkMode ? '#374151' : '#fecaca'}`,
                color: isDarkMode ? '#fca5a5' : '#dc2626',
              }}>
                {pushError}
              </div>
            )}

            {!pushError && getPushPermissionState() === 'denied' && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                fontSize: '12px', lineHeight: '1.5',
                backgroundColor: isDarkMode ? '#1e293b' : '#fef2f2',
                border: `1px solid ${isDarkMode ? '#374151' : '#fecaca'}`,
                color: isDarkMode ? '#fca5a5' : '#dc2626',
              }}>
                브라우저에서 알림이 차단되었습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.
              </div>
            )}
          </>
        )}
      </div>
    );
  }
}
