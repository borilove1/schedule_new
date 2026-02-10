import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';
import { ArrowLeft, Sun, Moon, CheckCircle, Eye, EyeOff, ChevronDown } from 'lucide-react';
import api from '../../utils/api';

// 커스텀 드롭다운 컴포넌트
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
          width: '100%',
          padding: '12px',
          borderRadius: '12px',
          border: `1px solid ${(isOpen || isFocused) ? '#3B82F6' : borderColor}`,
          backgroundColor: disabled ? (isDarkMode ? '#1a1a2e' : '#f3f4f6') : inputBg,
          color: value ? textColor : secondaryTextColor,
          fontSize: '14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingRight: '36px',
          position: 'relative',
          boxShadow: (isOpen || isFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
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
          overflow: 'hidden',
          maxHeight: maxItems ? `${maxItems * 40}px` : '200px',
          overflowY: 'auto',
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

export default function SignupPage({ onBackClick }) {
  const { register } = useAuth();
  const { toggleDarkMode } = useTheme();
  const colors = useThemeColors();
  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor, borderColor } = colors;
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

  const handleCustomChange = (name, value) => {
    if (name === 'division') {
      setFormData({ ...formData, division: value, office: '', department: '', position: '' });
    } else if (name === 'office') {
      setFormData({ ...formData, office: value, department: '', position: '' });
    } else if (name === 'department') {
      setFormData({ ...formData, department: value, position: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const availableOffices = formData.division ? (organizations.offices[formData.division] || []) : [];
  const availableDepartments = formData.office ? (organizations.departments[formData.office] || []) : [];

  // 직급 옵션 동적 생성 (소속에 따라 다름)
  const getPositionOptions = () => {
    const deptName = formData.department || '';
    const officeName = formData.office || '';

    // 직할 부서인 경우 특별 처리 (부서명 또는 처/실명에 '직할' 포함)
    if (deptName.includes('직할')) {
      // 1. 부서명 자체에 '본부' 포함 또는 처/실명에 '본부' 또는 '직할' 포함 -> 본부장
      if (deptName.includes('본부') || officeName.includes('본부') || officeName.includes('직할')) {
        return [{ value: '본부장', label: '본부장' }];
      }
      // 2. 부서명/처/실명에 '처' 포함 (사업처, 관리처 등) -> 처장
      if (deptName.includes('처') || officeName.includes('처')) {
        return [{ value: '처장', label: '처장' }];
      }
      // 3. 부서명/처/실명에 '실' 포함 (기획관리실 등) -> 실장
      if (deptName.includes('실') || officeName.includes('실')) {
        return [{ value: '실장', label: '실장' }];
      }
      // 4. 지사인 경우
      if (deptName.includes('지사') || officeName.includes('지사')) {
        return [{ value: '지사장', label: '지사장' }];
      }
      // 기본값 (기타 직할)
      return [{ value: '처장', label: '처장' }];
    }

    // 일반 부서 선택한 경우: 부장, 차장, 직원
    if (deptName) {
      return [
        { value: '부장', label: '부장' },
        { value: '차장', label: '차장' },
        { value: '과장', label: '과장' },
        { value: '대리', label: '대리' },
        { value: '사원', label: '사원' },
      ];
    }

    // 처/실만 선택한 경우 (부서 없음): 처/실장, 부장, 차장, 직원
    if (officeName) {
      const options = [];
      if (officeName.includes('실')) {
        options.push({ value: '실장', label: '실장' });
      } else if (officeName.includes('처')) {
        options.push({ value: '처장', label: '처장' });
      } else {
        options.push({ value: '지사장', label: '지사장' });
      }
      options.push(
        { value: '부장', label: '부장' },
        { value: '차장', label: '차장' },
        { value: '과장', label: '과장' },
        { value: '대리', label: '대리' },
        { value: '사원', label: '사원' },
      );
      return options;
    }

    // 아무것도 선택 안 한 경우
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.position) {
      setError('직급을 선택하세요.');
      return;
    }
    if (!formData.division) {
      setError('1차 사업소를 선택하세요.');
      return;
    }
    if (!formData.office) {
      setError('2차 사업소를 선택하세요.');
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    // eslint-disable-next-line
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
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: bgColor,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      transition: 'background-color 0.2s',
      zIndex: 100
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' }}>
          <span style={{ fontSize: '28px' }}>📋</span>
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
          {/* 1. 이름 */}
          <div style={{ marginBottom: '14px' }}>
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

          {/* 2. 소속 선택 */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>1차 사업소 *</label>
            <CustomSelect
              value={formData.division}
              onChange={(val) => handleCustomChange('division', val)}
              options={divisionOptions}
              placeholder="소속 사업소를 선택하세요"
              disabled={loadingOrgs}
              colors={colors}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>2차 사업소 *</label>
            <CustomSelect
              value={formData.office}
              onChange={(val) => handleCustomChange('office', val)}
              options={officeOptions}
              placeholder="소속 사업소를 선택하세요"
              disabled={!formData.division || loadingOrgs}
              colors={colors}
              maxItems={4}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>부서{availableDepartments.length > 0 ? ' *' : ''}</label>
            <CustomSelect
              value={formData.department}
              onChange={(val) => handleCustomChange('department', val)}
              options={departmentOptions}
              placeholder={availableDepartments.length > 0 ? '소속 부서를 선택하세요' : '해당 없음'}
              disabled={!formData.office || loadingOrgs || availableDepartments.length === 0}
              colors={colors}
              maxItems={4}
            />
          </div>

          {/* 3. 직급 (소속 선택 후 활성화) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>직급 *</label>
            <CustomSelect
              value={formData.position}
              onChange={(val) => handleCustomChange('position', val)}
              options={positionOptions}
              placeholder={positionOptions.length > 0 ? '직급을 선택하세요' : '소속을 먼저 선택하세요'}
              disabled={!formData.office || positionOptions.length === 0}
              colors={colors}
              maxItems={4}
            />
          </div>

          {/* 4. 이메일 */}
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

          {/* 5. 비밀번호 */}
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

          {/* 6. 비밀번호 확인 */}
          <div style={{ marginBottom: '28px' }}>
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
