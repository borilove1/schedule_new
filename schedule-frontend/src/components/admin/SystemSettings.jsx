import React, { useState, useEffect } from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import ErrorAlert from '../common/ErrorAlert';
import SuccessAlert from '../common/SuccessAlert';
import { Save, RefreshCw, Mail, Send, Eye, EyeOff, Bell } from 'lucide-react';
import api from '../../utils/api';

// 알림 타입별 메타데이터
const NOTIFICATION_TYPES = {
  EVENT_REMINDER:   { label: '일정 시작 알림', scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_DUE_SOON:   { label: '마감임박 알림', scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_OVERDUE:    { label: '일정 지연 알림', scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_UPDATED:    { label: '일정 수정',     scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_COMPLETED:  { label: '일정 완료',     scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_DELETED:    { label: '일정 삭제',     scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division', 'office'] },
  EVENT_COMMENTED:  { label: '새 댓글',       scopes: ['creator', 'department', 'dept_lead_department', 'dept_lead_office', 'dept_lead_division'] },
  EVENT_SHARED:     { label: '공유 일정',     scopes: ['shared_offices'] },
  USER_REGISTERED:  { label: '신규 가입 요청', scopes: ['admins'] },
  ACCOUNT_APPROVED: { label: '계정 승인',     scopes: ['target'] },
};

const SCOPE_LABELS = {
  creator: '작성자만',
  department: '같은 부서',
  dept_lead_department: '부장',
  dept_lead_office: '처장/실장',
  dept_lead_division: '본부장',
  office: '같은 처/실',
  shared_offices: '공유된 처/실',
  admins: '전체 관리자',
  target: '해당 사용자',
};

const SETTING_CONFIG = {
  // ===== 일반 설정 =====
  reminder_times: {
    label: '일정 시작 알림',
    description: '일정 시작 전 알림을 보낼 시간을 선택하세요 (복수 선택 가능)',
    type: 'multiSelect',
    options: [
      { value: '30min', label: '30분 전' },
      { value: '1hour', label: '1시간 전' },
      { value: '3hour', label: '3시간 전' },
    ],
  },
  due_soon_threshold: {
    label: '마감임박 기준 시간',
    description: '일정 종료 전 마감임박 뱃지 표시 및 알림을 보낼 시간 (복수 선택 가능)',
    type: 'multiSelect',
    options: [
      { value: '30min', label: '30분 전' },
      { value: '1hour', label: '1시간 전' },
      { value: '3hour', label: '3시간 전' },
    ],
  },

  // ===== 이메일 설정 =====
  email_enabled: {
    label: '이메일 알림 활성화',
    description: '이메일 알림 기능을 활성화합니다. SMTP 설정이 필요합니다.',
    type: 'boolean',
    section: 'email',
  },
  smtp_auth_type: {
    label: 'SMTP 인증 방식',
    description: '이메일 서버 인증 방식을 선택합니다.',
    type: 'select',
    section: 'email',
    options: [
      { value: 'LOGIN', label: '로그인 (사용자명/비밀번호)' },
      { value: 'NONE', label: '인증 없음 (내부 릴레이)' },
      { value: 'API_KEY', label: 'API 키 (SendGrid/Mailgun)' },
    ],
  },
  smtp_host: {
    label: 'SMTP 호스트',
    description: 'SMTP 서버 주소 (예: smtp.gmail.com)',
    type: 'text',
    section: 'email',
    placeholder: 'smtp.example.com',
  },
  smtp_port: {
    label: 'SMTP 포트',
    description: 'SMTP 서버 포트 (587: TLS, 465: SSL, 25: 비보안)',
    type: 'number',
    section: 'email',
  },
  smtp_secure: {
    label: 'SSL/TLS 사용',
    description: '포트 465를 사용하는 경우 활성화합니다.',
    type: 'boolean',
    section: 'email',
  },
  smtp_user: {
    label: 'SMTP 사용자명',
    description: 'SMTP 로그인 사용자명 또는 이메일 주소',
    type: 'text',
    section: 'email',
    placeholder: 'user@example.com',
    showWhen: (settings) => settings.smtp_auth_type === 'LOGIN',
  },
  smtp_password: {
    label: 'SMTP 비밀번호',
    description: 'SMTP 로그인 비밀번호 또는 앱 비밀번호',
    type: 'password',
    section: 'email',
    showWhen: (settings) => settings.smtp_auth_type === 'LOGIN',
  },
  smtp_api_key: {
    label: 'API 키',
    description: 'SendGrid, Mailgun 등의 API 키',
    type: 'password',
    section: 'email',
    showWhen: (settings) => settings.smtp_auth_type === 'API_KEY',
  },
  smtp_from_email: {
    label: '발신 이메일',
    description: '이메일 알림의 발신자 주소',
    type: 'text',
    section: 'email',
    placeholder: 'noreply@example.com',
  },
  smtp_from_name: {
    label: '발신자 이름',
    description: '이메일 알림의 발신자 표시 이름',
    type: 'text',
    section: 'email',
    placeholder: '업무일정 관리 시스템',
  },
};

export default function SystemSettings() {
  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor, inputBg } = useThemeColors();
  const [settings, setSettings] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 이메일 테스트 상태
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // 비밀번호 필드 표시 상태
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const inputStyle = {
    padding: '8px 12px',
    border: `1px solid ${borderColor}`,
    borderRadius: '6px',
    backgroundColor: inputBg,
    color: textColor,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSettings();
      setSettings(data);
      setOriginal(data);
    } catch (err) {
      setError(err.message || '설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const changed = {};
      for (const key of Object.keys(settings)) {
        if (JSON.stringify(settings[key]) !== JSON.stringify(original[key])) {
          changed[key] = settings[key];
        }
      }

      if (Object.keys(changed).length === 0) {
        setSuccess('변경된 설정이 없습니다.');
        setSaving(false);
        return;
      }

      await api.updateSettings(changed);
      setOriginal({ ...settings });
      setSuccess('설정이 저장되었습니다.');
    } catch (err) {
      setError(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...original });
    setSuccess('');
    setError('');
    setTestResult(null);
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestResult(null);
    try {
      const result = await api.sendTestEmail();
      setTestResult({ success: true, message: result.message || '테스트 이메일이 발송되었습니다.' });
    } catch (err) {
      setTestResult({ success: false, message: err.message || '테스트 이메일 발송에 실패했습니다.' });
    } finally {
      setTestingEmail(false);
    }
  };

  const togglePasswordVisibility = (key) => {
    setVisiblePasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: secondaryTextColor }}>설정 로딩 중...</div>;
  }

  const renderSettingRow = (key, config, isLast) => {
    const value = settings[key];

    return (
      <div key={key} style={{
        padding: '20px 24px',
        borderBottom: isLast ? 'none' : `1px solid ${borderColor}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: textColor, marginBottom: '4px' }}>
            {config.label}
          </div>
          <div style={{ fontSize: '12px', color: secondaryTextColor }}>
            {config.description}
          </div>
        </div>

        <div style={{ minWidth: '160px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          {config.type === 'number' && (
            <>
              <input
                type="number" value={value ?? ''}
                onChange={e => handleChange(key, parseInt(e.target.value) || 0)}
                style={{ ...inputStyle, width: '80px', textAlign: 'right' }} min={0}
              />
              {config.unit && <span style={{ fontSize: '13px', color: secondaryTextColor }}>{config.unit}</span>}
            </>
          )}
          {config.type === 'boolean' && (
            <button
              onClick={() => handleChange(key, !value)}
              style={{
                width: '48px', height: '26px', borderRadius: '13px',
                border: 'none', cursor: 'pointer', position: 'relative',
                backgroundColor: value ? '#3B82F6' : (isDarkMode ? '#475569' : '#cbd5e1'),
                transition: 'background-color 0.2s',
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                backgroundColor: '#fff', position: 'absolute', top: '3px',
                left: value ? '25px' : '3px', transition: 'left 0.2s',
              }} />
            </button>
          )}
          {config.type === 'select' && (
            <select
              value={value ?? ''}
              onChange={e => handleChange(key, e.target.value)}
              style={{ ...inputStyle, minWidth: '120px' }}
            >
              {config.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          {config.type === 'text' && (
            <input
              type="text" value={value ?? ''}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={config.placeholder || ''}
              style={{ ...inputStyle, width: '220px' }}
            />
          )}
          {config.type === 'multiSelect' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {config.options.map(opt => {
                const selected = Array.isArray(value) && value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const current = Array.isArray(value) ? [...value] : [];
                      if (selected) {
                        handleChange(key, current.filter(v => v !== opt.value));
                      } else {
                        handleChange(key, [...current, opt.value]);
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '16px',
                      border: `1px solid ${selected ? '#3B82F6' : borderColor}`,
                      backgroundColor: selected ? (isDarkMode ? '#1e3a5f' : '#dbeafe') : 'transparent',
                      color: selected ? '#3B82F6' : secondaryTextColor,
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: selected ? '500' : '400',
                      transition: 'all 0.2s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
          {config.type === 'password' && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={visiblePasswords[key] ? 'text' : 'password'}
                value={value ?? ''}
                onChange={e => handleChange(key, e.target.value)}
                style={{ ...inputStyle, width: '220px', paddingRight: '36px' }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility(key)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: secondaryTextColor, padding: '2px', display: 'flex',
                }}
              >
                {visiblePasswords[key] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 일반 설정과 이메일 설정 분리
  const generalEntries = Object.entries(SETTING_CONFIG).filter(([, config]) => !config.section);
  const emailEntries = Object.entries(SETTING_CONFIG)
    .filter(([, config]) => config.section === 'email')
    .filter(([, config]) => !config.showWhen || config.showWhen(settings));

  const sectionHeaderStyle = {
    fontSize: '15px',
    fontWeight: '600',
    color: textColor,
    marginBottom: '12px',
    marginTop: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const cardStyle = {
    backgroundColor: cardBg, borderRadius: '8px',
    border: `1px solid ${borderColor}`, overflow: 'hidden',
    transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden',
  };

  return (
    <div>
      <ErrorAlert message={error} />
      <SuccessAlert message={success} />

      {/* 일반 설정 */}
      <div style={sectionHeaderStyle}>일반 설정</div>
      <div style={cardStyle}>
        {generalEntries.map(([key, config], index) =>
          renderSettingRow(key, config, index === generalEntries.length - 1)
        )}
      </div>

      {/* 알림 설정 */}
      <div style={sectionHeaderStyle}>
        <Bell size={18} /> 알림 발송 설정
      </div>
      <div style={cardStyle}>
        {Object.entries(NOTIFICATION_TYPES).map(([type, meta], index, arr) => {
          const config = settings.notification_config || {};
          const typeConfig = config[type] || { enabled: false, scopes: [] };
          // 기존 단일 scope를 배열로 마이그레이션
          const selectedScopes = Array.isArray(typeConfig.scopes)
            ? typeConfig.scopes
            : (typeConfig.scope ? [typeConfig.scope] : []);
          const isLast = index === arr.length - 1;
          const hasSingleScope = meta.scopes.length <= 1;

          const toggleScope = (scopeValue) => {
            let newScopes;
            if (selectedScopes.includes(scopeValue)) {
              newScopes = selectedScopes.filter(s => s !== scopeValue);
            } else {
              newScopes = [...selectedScopes, scopeValue];
            }
            const updated = { ...config, [type]: { ...typeConfig, scopes: newScopes } };
            handleChange('notification_config', updated);
          };

          return (
            <div key={type} style={{
              padding: '16px 24px',
              borderBottom: isLast ? 'none' : `1px solid ${borderColor}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>
                    {meta.label}
                  </div>
                </div>

                {/* ON/OFF 토글 */}
                <button
                  onClick={() => {
                    const updated = { ...config, [type]: { ...typeConfig, enabled: !typeConfig.enabled } };
                    handleChange('notification_config', updated);
                  }}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px',
                    border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                    backgroundColor: typeConfig.enabled ? '#3B82F6' : (isDarkMode ? '#475569' : '#cbd5e1'),
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    backgroundColor: '#fff', position: 'absolute', top: '3px',
                    left: typeConfig.enabled ? '25px' : '3px', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* 수신 범위 복수선택 (활성화된 경우만 표시) */}
              {typeConfig.enabled && !hasSingleScope && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}>
                  {meta.scopes.map(scopeValue => {
                    const isSelected = selectedScopes.includes(scopeValue);
                    return (
                      <button
                        key={scopeValue}
                        onClick={() => toggleScope(scopeValue)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '16px',
                          border: `1px solid ${isSelected ? '#3B82F6' : borderColor}`,
                          backgroundColor: isSelected
                            ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)')
                            : 'transparent',
                          color: isSelected ? '#3B82F6' : secondaryTextColor,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {SCOPE_LABELS[scopeValue]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div style={{
          padding: '12px 24px',
          fontSize: '12px',
          color: secondaryTextColor,
          borderTop: `1px solid ${borderColor}`,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        }}>
          * 비활성화된 알림은 인앱/푸시/이메일 모두 발송되지 않습니다. 행위자 본인에게는 알림이 발송되지 않습니다.
        </div>
      </div>

      {/* 이메일 알림 설정 */}
      <div style={sectionHeaderStyle}>
        <Mail size={18} /> 이메일 알림 설정
      </div>
      <div style={cardStyle}>
        {emailEntries.map(([key, config], index) =>
          renderSettingRow(key, config, index === emailEntries.length - 1)
        )}
      </div>

      {/* 테스트 이메일 */}
      {settings.email_enabled && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={handleTestEmail}
            disabled={testingEmail || !settings.smtp_host}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', border: `1px solid ${borderColor}`, borderRadius: '6px',
              backgroundColor: 'transparent',
              color: (testingEmail || !settings.smtp_host) ? secondaryTextColor : textColor,
              cursor: (testingEmail || !settings.smtp_host) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: (testingEmail || !settings.smtp_host) ? 0.5 : 1,
            }}
          >
            <Send size={16} /> {testingEmail ? '발송 중...' : '테스트 이메일 발송'}
          </button>
          {testResult && (
            <div style={{
              marginTop: '8px', padding: '10px 16px', borderRadius: '6px', fontSize: '13px',
              backgroundColor: testResult.success ? '#10b98120' : '#ef444420',
              color: testResult.success ? '#10b981' : '#ef4444',
            }}>
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* 저장 / 초기화 버튼 */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button
          onClick={handleReset} disabled={!hasChanges}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 20px', border: `1px solid ${borderColor}`, borderRadius: '6px',
            backgroundColor: 'transparent', color: hasChanges ? textColor : secondaryTextColor,
            cursor: hasChanges ? 'pointer' : 'not-allowed', fontSize: '14px',
            opacity: hasChanges ? 1 : 0.5,
          }}
        >
          <RefreshCw size={16} /> 초기화
        </button>
        <button
          onClick={handleSave} disabled={saving || !hasChanges}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 20px', border: 'none', borderRadius: '6px',
            backgroundColor: '#3B82F6', color: '#fff',
            cursor: (saving || !hasChanges) ? 'not-allowed' : 'pointer', fontSize: '14px',
            opacity: (saving || !hasChanges) ? 0.6 : 1,
          }}
        >
          <Save size={16} /> {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
