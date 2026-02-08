import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';
import { Calendar, ArrowLeft, Sun, Moon, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';

export default function SignupPage({ onBackClick }) {
  const { register } = useAuth();
  const { toggleDarkMode } = useTheme();
  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const { inputStyle, labelStyle } = useCommonStyles();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    position: '',
    division: '',
    office: '',
    department: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [organizations, setOrganizations] = useState({
    divisions: [],
    offices: {},
    departments: {}
  });
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // 조직 구조 로드
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const data = await api.request('/organizations/structure');
        setOrganizations(data.organization || {
          divisions: ['부산울산본부'],
          offices: {
            '부산울산본부': [
              '기획관리실', '전력사업처', '전력관리처', '안전재난부',
              '울산지사', '김해지사', '동래지사', '남부산지사', '양산지사',
              '중부산지사', '북부산지사', '동울산지사', '서부산지사', '기장지사',
              '서울산지사', '영도지사', '울산전력지사', '북부산전력지사',
              '동부산전력지사', '서부산전력지사'
            ]
          },
          departments: {
            '기획관리실': ['전략경영부', '경영지원부', '재무자재부', 'AI혁신부'],
            '전력사업처': ['고객지원부', '전력공급부', '요금관리부', '배전운영부', '에너지효율부', '배전건설부', 'ICT운영부'],
            '전력관리처': ['송변전안전팀', '지역협력부', '계통운영부', '송전운영부', '변전운영부', '설비보강부', '전자제어부', '토건운영부']
          }
        });
        setLoadingOrgs(false);
      } catch (error) {
        console.error('Failed to load organizations:', error);
        setOrganizations({
          divisions: ['부산울산본부'],
          offices: {
            '부산울산본부': [
              '기획관리실', '전력사업처', '전력관리처', '안전재난부',
              '울산지사', '김해지사', '동래지사', '남부산지사', '양산지사',
              '중부산지사', '북부산지사', '동울산지사', '서부산지사', '기장지사',
              '서울산지사', '영도지사', '울산전력지사', '북부산전력지사',
              '동부산전력지사', '서부산전력지사'
            ]
          },
          departments: {
            '기획관리실': ['전략경영부', '경영지원부', '재무자재부', 'AI혁신부'],
            '전력사업처': ['고객지원부', '전력공급부', '요금관리부', '배전운영부', '에너지효율부', '배전건설부', 'ICT운영부'],
            '전력관리처': ['송변전안전팀', '지역협력부', '계통운영부', '송전운영부', '변전운영부', '설비보강부', '전자제어부', '토건운영부']
          }
        });
        setLoadingOrgs(false);
      }
    };
    loadOrganizations();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'division') {
      setFormData({ ...formData, division: value, office: '', department: '' });
    } else if (name === 'office') {
      setFormData({ ...formData, office: value, department: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const availableOffices = formData.division ? (organizations.offices[formData.division] || []) : [];
  const availableDepartments = formData.office ? (organizations.departments[formData.office] || []) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(formData.password)) {
      setError('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const { passwordConfirm, ...submitData } = formData;
      const result = await register(submitData);
      if (result.requiresApproval) {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.');
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
        maxWidth: '500px',
        backgroundColor: cardBg,
        borderRadius: '16px',
        padding: '28px 32px',
        boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.3)' : '0 10px 40px rgba(0,0,0,0.08)',
        transition: 'background-color 0.2s, box-shadow 0.2s'
      }}>
        {/* 상단: 뒤로가기 + 다크모드 토글 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button
            onClick={onBackClick}
            style={{
              background: 'none',
              border: 'none',
              color: secondaryTextColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px'
            }}
          >
            <ArrowLeft size={20} /> 로그인으로 돌아가기
          </button>
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
          <Calendar size={36} color="#3B82F6" style={{ margin: '0 auto 10px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: textColor, margin: 0 }}>
            회원가입
          </h1>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor, marginBottom: '12px' }}>
              회원가입 완료
            </h2>
            <p style={{ color: secondaryTextColor, fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
              회원가입이 완료되었습니다.<br />
              관리자 승인 후 로그인이 가능합니다.
            </p>
            <button
              onClick={onBackClick}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3B82F6',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              로그인 페이지로 돌아가기
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>이름 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                autoFocus
                style={inputStyle}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label style={labelStyle}>직급 *</label>
              <select
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
                style={inputStyle}
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

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>이메일 *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={inputStyle}
              placeholder="email@example.com"
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>비밀번호 *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder="영문, 숫자, 특수문자 포함 8자 이상"
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

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>비밀번호 확인 *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswordConfirm ? 'text' : 'password'}
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                required
                minLength={8}
                style={{
                  ...inputStyle,
                  paddingRight: '44px',
                  borderColor: formData.passwordConfirm && formData.password !== formData.passwordConfirm
                    ? '#ef4444' : borderColor
                }}
                placeholder="비밀번호를 다시 입력하세요"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
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
                title={showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.passwordConfirm && formData.password !== formData.passwordConfirm && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                비밀번호가 일치하지 않습니다.
              </div>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>1차 사업소 *</label>
            <select
              name="division"
              value={formData.division}
              onChange={handleChange}
              required
              disabled={loadingOrgs}
              style={inputStyle}
            >
              <option value="">소속 사업소를 선택하세요</option>
              {organizations.divisions.map(division => {
                const name = typeof division === 'string' ? division : division.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>2차 사업소 *</label>
            <select
              name="office"
              value={formData.office}
              onChange={handleChange}
              required
              disabled={!formData.division || loadingOrgs}
              style={inputStyle}
            >
              <option value="">소속 사업소를 선택하세요</option>
              {availableOffices.map(office => {
                const name = typeof office === 'string' ? office : office.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>부서{availableDepartments.length > 0 ? ' *' : ''}</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              required={availableDepartments.length > 0}
              disabled={!formData.office || loadingOrgs || availableDepartments.length === 0}
              style={inputStyle}
            >
              <option value="">{availableDepartments.length > 0 ? '소속 부서를 선택하세요' : '해당 없음'}</option>
              {availableDepartments.map(department => {
                const name = typeof department === 'string' ? department : department.name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <ErrorAlert message={error} />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#1e40af' : '#3B82F6',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
