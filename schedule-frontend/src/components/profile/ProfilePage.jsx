import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import { ArrowLeft, Save, Lock, CheckCircle, Mail } from 'lucide-react';
import ErrorAlert from '../common/ErrorAlert';
import api from '../../utils/api';

export default function ProfilePage({ onBack }) {
  const { user, updateProfile } = useAuth();
  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const { inputStyle, labelStyle, selectStyle } = useCommonStyles();

  // 프로필 수정 상태
  const [profileData, setProfileData] = useState({
    name: '',
    position: '',
    division: '',
    office: '',
    department: ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // 비밀번호 변경 상태
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 이메일 알림 설정
  const [emailPrefs, setEmailPrefs] = useState({
    emailNotificationsEnabled: false,
    emailPreferences: {
      EVENT_REMINDER: true,
      EVENT_UPDATED: true,
      EVENT_COMPLETED: true,
      EVENT_DELETED: true,
      USER_REGISTERED: true,
      ACCOUNT_APPROVED: true,
    }
  });
  const [emailPrefsOriginal, setEmailPrefsOriginal] = useState(null);
  const [systemEmailEnabled, setSystemEmailEnabled] = useState(false);
  const [emailPrefsLoading, setEmailPrefsLoading] = useState(false);
  const [emailPrefsError, setEmailPrefsError] = useState('');
  const [emailPrefsSuccess, setEmailPrefsSuccess] = useState('');

  // 조직 구조
  const [organizations, setOrganizations] = useState({
    divisions: [],
    offices: {},
    departments: {}
  });

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        position: user.position || '',
        division: user.division || '',
        office: user.office || '',
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

  const availableOffices = profileData.division ? (organizations.offices[profileData.division] || []) : [];
  const availableDepartments = profileData.office ? (organizations.departments[profileData.office] || []) : [];

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    if (name === 'division') {
      setProfileData(prev => ({ ...prev, division: value, office: '', department: '' }));
    } else if (name === 'office') {
      setProfileData(prev => ({ ...prev, office: value, department: '' }));
    } else {
      setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword.length < 8) {
      setPasswordError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(passwordData.newPassword)) {
      setPasswordError('새 비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
      return;
    }

    if (passwordData.newPassword !== passwordData.newPasswordConfirm) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
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

  const handleEmailPrefsSave = async () => {
    setEmailPrefsLoading(true);
    setEmailPrefsError('');
    setEmailPrefsSuccess('');
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
    EVENT_REMINDER: '일정 알림 (마감 임박)',
    EVENT_UPDATED: '일정 수정 알림',
    EVENT_COMPLETED: '일정 완료 알림',
    EVENT_DELETED: '일정 삭제 알림',
    USER_REGISTERED: '사용자 가입 알림',
    ACCOUNT_APPROVED: '계정 승인 알림',
  };

  const sectionStyle = {
    backgroundColor: cardBg,
    borderRadius: '12px',
    border: `1px solid ${borderColor}`,
    padding: '24px',
    marginBottom: '20px',
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: textColor,
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const btnStyle = {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#3B82F6',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const successStyle = {
    padding: '10px 16px',
    borderRadius: '8px',
    backgroundColor: '#10b98120',
    color: '#10b981',
    fontSize: '13px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: secondaryTextColor,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
          marginBottom: '20px',
          fontSize: '14px',
        }}
      >
        <ArrowLeft size={18} /> 돌아가기
      </button>

      <h2 style={{ fontSize: '22px', fontWeight: '600', color: textColor, marginBottom: '24px' }}>
        내 정보 수정
      </h2>

      {/* 기본 정보 (읽기 전용) */}
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: secondaryTextColor, marginBottom: '4px' }}>이메일</div>
        <div style={{ fontSize: '15px', color: textColor, fontWeight: '500' }}>{user?.email}</div>
        <div style={{ fontSize: '13px', color: secondaryTextColor, marginBottom: '4px', marginTop: '12px' }}>역할</div>
        <div style={{ fontSize: '15px', color: textColor, fontWeight: '500' }}>
          {user?.role === 'ADMIN' ? '관리자' : user?.role === 'DEPT_LEAD' ? '부서장' : '일반 사용자'}
        </div>
      </div>

      {/* 프로필 수정 */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Save size={18} /> 기본 정보
        </div>

        {profileSuccess && (
          <div style={successStyle}>
            <CheckCircle size={16} /> {profileSuccess}
          </div>
        )}
        <ErrorAlert message={profileError} />

        <form onSubmit={handleProfileSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>이름</label>
              <input
                type="text"
                name="name"
                value={profileData.name}
                onChange={handleProfileChange}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>직급</label>
              <select
                name="position"
                value={profileData.position}
                onChange={handleProfileChange}
                required
                style={selectStyle}
              >
                <option value="">선택</option>
                <option value="사원">사원</option>
                <option value="대리">대리</option>
                <option value="과장">과장</option>
                <option value="차장">차장</option>
                <option value="부장">부장</option>
                <option value="처장">처장</option>
                <option value="본부장">본부장</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>본부</label>
            <select
              name="division"
              value={profileData.division}
              onChange={handleProfileChange}
              required
              style={selectStyle}
            >
              <option value="">선택하세요</option>
              {organizations.divisions.map(div => {
                const name = typeof div === 'string' ? div : div.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>처</label>
            <select
              name="office"
              value={profileData.office}
              onChange={handleProfileChange}
              required
              disabled={!profileData.division}
              style={selectStyle}
            >
              <option value="">선택하세요</option>
              {availableOffices.map(off => {
                const name = typeof off === 'string' ? off : off.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>부서{availableDepartments.length > 0 ? '' : ' (해당 없음)'}</label>
            <select
              name="department"
              value={profileData.department}
              onChange={handleProfileChange}
              required={availableDepartments.length > 0}
              disabled={!profileData.office || availableDepartments.length === 0}
              style={selectStyle}
            >
              <option value="">{availableDepartments.length > 0 ? '선택하세요' : '해당 없음'}</option>
              {availableDepartments.map(dept => {
                const name = typeof dept === 'string' ? dept : dept.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <button type="submit" disabled={profileLoading} style={{ ...btnStyle, opacity: profileLoading ? 0.7 : 1 }}>
            <Save size={16} /> {profileLoading ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>

      {/* 비밀번호 변경 */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <Lock size={18} /> 비밀번호 변경
        </div>

        {passwordSuccess && (
          <div style={successStyle}>
            <CheckCircle size={16} /> {passwordSuccess}
          </div>
        )}
        <ErrorAlert message={passwordError} />

        <form onSubmit={handlePasswordSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>현재 비밀번호</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={e => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>새 비밀번호</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={e => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              required
              minLength={8}
              style={inputStyle}
              placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>새 비밀번호 확인</label>
            <input
              type="password"
              value={passwordData.newPasswordConfirm}
              onChange={e => setPasswordData(prev => ({ ...prev, newPasswordConfirm: e.target.value }))}
              required
              minLength={8}
              style={{
                ...inputStyle,
                borderColor: passwordData.newPasswordConfirm && passwordData.newPassword !== passwordData.newPasswordConfirm
                  ? '#ef4444' : borderColor
              }}
            />
            {passwordData.newPasswordConfirm && passwordData.newPassword !== passwordData.newPasswordConfirm && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                비밀번호가 일치하지 않습니다.
              </div>
            )}
          </div>

          <button type="submit" disabled={passwordLoading} style={{ ...btnStyle, opacity: passwordLoading ? 0.7 : 1 }}>
            <Lock size={16} /> {passwordLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>

      {/* 이메일 알림 설정 */}
      <div style={{ ...sectionStyle, opacity: systemEmailEnabled ? 1 : 0.7 }}>
        <div style={sectionTitleStyle}>
          <Mail size={18} /> 이메일 알림 설정
        </div>

        {/* 시스템 이메일 비활성화 안내 */}
        {!systemEmailEnabled && (
          <div style={{
            padding: '14px 16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            border: `1px solid ${borderColor}`,
            color: secondaryTextColor,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Mail size={18} style={{ flexShrink: 0, opacity: 0.5 }} />
            <span>이메일 알림 기능이 현재 비활성화 상태입니다. 관리자가 시스템 설정에서 이메일 알림을 활성화한 후 사용할 수 있습니다.</span>
          </div>
        )}

        {systemEmailEnabled && (
          <>
            {emailPrefsSuccess && (
              <div style={successStyle}>
                <CheckCircle size={16} /> {emailPrefsSuccess}
              </div>
            )}
            <ErrorAlert message={emailPrefsError} />

            {/* 마스터 토글 */}
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
              <button
                type="button"
                onClick={() => setEmailPrefs(prev => ({ ...prev, emailNotificationsEnabled: !prev.emailNotificationsEnabled }))}
                style={{
                  width: '48px', height: '26px', borderRadius: '13px',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  backgroundColor: emailPrefs.emailNotificationsEnabled ? '#3B82F6' : (isDarkMode ? '#475569' : '#cbd5e1'),
                  transition: 'background-color 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  backgroundColor: '#fff', position: 'absolute', top: '3px',
                  left: emailPrefs.emailNotificationsEnabled ? '25px' : '3px',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* 타입별 토글 */}
            {emailPrefs.emailNotificationsEnabled && (
              <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '16px' }}>
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0',
                  }}>
                    <span style={{ fontSize: '14px', color: textColor }}>{label}</span>
                    <button
                      type="button"
                      onClick={() => setEmailPrefs(prev => ({
                        ...prev,
                        emailPreferences: {
                          ...prev.emailPreferences,
                          [type]: !prev.emailPreferences[type]
                        }
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
                        left: emailPrefs.emailPreferences[type] ? '23px' : '3px',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleEmailPrefsSave}
              disabled={emailPrefsLoading || !emailPrefsHasChanges}
              style={{
                ...btnStyle,
                marginTop: '16px',
                opacity: (emailPrefsLoading || !emailPrefsHasChanges) ? 0.5 : 1,
                cursor: (emailPrefsLoading || !emailPrefsHasChanges) ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={16} /> {emailPrefsLoading ? '저장 중...' : '저장'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
