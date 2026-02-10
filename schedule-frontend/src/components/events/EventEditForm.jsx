import React, { useState, useRef, useEffect } from 'react';
import { Share2, ChevronDown } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';
import api from '../../utils/api';

// 직급 옵션 (본부장 > 처장 > 실장 > 부장 > 차장 > 직원)
const POSITION_OPTIONS = [
  { value: '본부장', label: '본부장' },
  { value: '처장', label: '처장' },
  { value: '실장', label: '실장' },
  { value: '부장', label: '부장' },
  { value: '차장', label: '차장' },
  { value: 'staff', label: '직원', includes: ['사원', '대리', '과장'] },
];

export default function EventEditForm({
  formData, onChange, onSubmit, onCancel, editType, event, loading, actionInProgress, error,
  offices = [], sharedTargets = [], onSharedTargetsChange, onRecurringToggle, rateLimitCountdown = 0
}) {
  const { isDarkMode, borderColor, textColor, cardBg, bgColor, secondaryTextColor } = useThemeColors();
  const isMobile = useIsMobile();
  const { inputStyle, labelStyle, fontFamily } = useCommonStyles();
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [priorityFocusedIdx, setPriorityFocusedIdx] = useState(-1);
  const [priorityIsFocused, setPriorityIsFocused] = useState(false);
  const priorityDropdownRef = useRef(null);

  // 공유 대상 선택 관련 상태
  const [shareOfficeId, setShareOfficeId] = useState('');
  const [shareDepartmentId, setShareDepartmentId] = useState('');
  const [sharePositions, setSharePositions] = useState([]);
  const [shareDepartments, setShareDepartments] = useState([]);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const officeDropdownRef = useRef(null);
  const departmentDropdownRef = useRef(null);
  const positionDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target)) {
        setShowPriorityDropdown(false);
      }
      if (officeDropdownRef.current && !officeDropdownRef.current.contains(e.target)) {
        setShowOfficeDropdown(false);
      }
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(e.target)) {
        setShowDepartmentDropdown(false);
      }
      if (positionDropdownRef.current && !positionDropdownRef.current.contains(e.target)) {
        setShowPositionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 처/실 선택 시 부서 목록 로드
  useEffect(() => {
    if (shareOfficeId) {
      api.getDepartments(shareOfficeId).then(data => {
        const list = data?.departments || data || [];
        setShareDepartments(Array.isArray(list) ? list : []);
      }).catch(() => setShareDepartments([]));
    } else {
      setShareDepartments([]);
      setShareDepartmentId('');
    }
  }, [shareOfficeId]);

  // 공유 대상 추가
  const handleAddShareTarget = () => {
    if (!shareOfficeId) return;
    const office = offices.find(o => o.id === parseInt(shareOfficeId));
    if (!office) return;

    const department = shareDepartmentId ? shareDepartments.find(d => d.id === parseInt(shareDepartmentId)) : null;

    const newTarget = {
      officeId: parseInt(shareOfficeId),
      officeName: office.name,
      departmentId: department ? department.id : null,
      departmentName: department ? department.name : null,
      positions: sharePositions.length > 0 ? [...sharePositions] : null
    };

    // 중복 체크
    const isDuplicate = sharedTargets.some(t =>
      t.officeId === newTarget.officeId &&
      t.departmentId === newTarget.departmentId &&
      JSON.stringify(t.positions) === JSON.stringify(newTarget.positions)
    );

    if (!isDuplicate) {
      onSharedTargetsChange([...sharedTargets, newTarget]);
    }

    // 선택 초기화
    setShareOfficeId('');
    setShareDepartmentId('');
    setSharePositions([]);
  };

  // 공유 대상 삭제
  const handleRemoveShareTarget = (idx) => {
    onSharedTargetsChange(sharedTargets.filter((_, i) => i !== idx));
  };

  // 직급 토글 (직원 선택 시 사원/대리/과장 한꺼번에 토글)
  const toggleSharePosition = (position) => {
    const opt = POSITION_OPTIONS.find(o => o.value === position);
    if (opt?.includes) {
      // 직원(staff) - 사원/대리/과장 모두 토글
      const allIncluded = opt.includes.every(p => sharePositions.includes(p));
      if (allIncluded) {
        setSharePositions(prev => prev.filter(p => !opt.includes.includes(p)));
      } else {
        setSharePositions(prev => [...new Set([...prev, ...opt.includes])]);
      }
    } else {
      setSharePositions(prev =>
        prev.includes(position) ? prev.filter(p => p !== position) : [...prev, position]
      );
    }
  };

  // 직급이 선택되었는지 확인 (직원은 사원/대리/과장 모두 선택 시 체크)
  const isPositionSelected = (position) => {
    const opt = POSITION_OPTIONS.find(o => o.value === position);
    if (opt?.includes) {
      return opt.includes.every(p => sharePositions.includes(p));
    }
    return sharePositions.includes(position);
  };

  // 표시용 직급 문자열 (사원/대리/과장 모두 선택 시 '직원'으로 표시)
  const getDisplayPositions = () => {
    if (sharePositions.length === 0) return '직급 전체';
    const staffPositions = ['사원', '대리', '과장'];
    const hasAllStaff = staffPositions.every(p => sharePositions.includes(p));
    const nonStaff = sharePositions.filter(p => !staffPositions.includes(p));
    if (hasAllStaff) {
      return nonStaff.length > 0 ? [...nonStaff, '직원'].join(', ') : '직원';
    }
    return sharePositions.join(', ');
  };

  const fieldHeight = isMobile ? '40px' : '46px';

  const dateInputStyle = {
    ...inputStyle,
    height: fieldHeight,
    padding: isMobile ? '8px 10px' : '12px',
    fontSize: isMobile ? '13px' : '14px',
    colorScheme: isDarkMode ? 'dark' : 'light',
  };

  const uniformInputStyle = {
    ...inputStyle,
    height: fieldHeight,
    padding: isMobile ? '8px 10px' : '12px',
    fontSize: isMobile ? '13px' : '14px',
  };

  const priorityOptions = [
    { value: 'LOW', label: '낮음' },
    { value: 'NORMAL', label: '보통' },
    { value: 'HIGH', label: '높음' },
  ];

  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>제목 *</label>
        <input type="text" name="title" value={formData.title} onChange={onChange} required style={uniformInputStyle} placeholder="일정 제목을 입력하세요" />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>내용</label>
        <textarea name="content" value={formData.content} onChange={onChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="일정 내용을 입력하세요" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: '14px' }}>
        <div>
          <label style={labelStyle}>시작 날짜 *</label>
          <input type="date" name="startDate" value={formData.startDate} onChange={onChange} required style={dateInputStyle} />
        </div>
        <div>
          <label style={labelStyle}>시작 시간 *</label>
          <input type="time" name="startTime" value={formData.startTime} onChange={onChange} required style={dateInputStyle} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: '14px' }}>
        <div>
          <label style={labelStyle}>종료 날짜 *</label>
          <input type="date" name="endDate" value={formData.endDate} onChange={onChange} required style={dateInputStyle} />
        </div>
        <div>
          <label style={labelStyle}>종료 시간 *</label>
          <input type="time" name="endTime" value={formData.endTime} onChange={onChange} required style={dateInputStyle} />
        </div>
      </div>

      {/* 우선순위 */}
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>우선순위</label>
        <div ref={priorityDropdownRef} style={{ position: 'relative' }}>
          <div
            tabIndex={0}
            onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); const idx = priorityOptions.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (showPriorityDropdown && priorityFocusedIdx >= 0) {
                  onChange({ target: { name: 'priority', value: priorityOptions[priorityFocusedIdx].value } });
                  setShowPriorityDropdown(false);
                } else {
                  setShowPriorityDropdown(!showPriorityDropdown);
                  const idx = priorityOptions.findIndex(o => o.value === formData.priority);
                  setPriorityFocusedIdx(idx >= 0 ? idx : 0);
                }
              } else if (e.key === 'Escape') { setShowPriorityDropdown(false); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); if (!showPriorityDropdown) { setShowPriorityDropdown(true); const idx = priorityOptions.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); } else { setPriorityFocusedIdx(prev => Math.min(prev + 1, priorityOptions.length - 1)); } }
              else if (e.key === 'ArrowUp') { e.preventDefault(); if (!showPriorityDropdown) { setShowPriorityDropdown(true); const idx = priorityOptions.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); } else { setPriorityFocusedIdx(prev => Math.max(prev - 1, 0)); } }
              else if (e.key === 'Tab') { if (showPriorityDropdown) setShowPriorityDropdown(false); }
            }}
            onFocus={() => setPriorityIsFocused(true)}
            onBlur={() => setPriorityIsFocused(false)}
            style={{
              ...uniformInputStyle,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingRight: '36px',
              position: 'relative',
              borderColor: (showPriorityDropdown || priorityIsFocused) ? '#3B82F6' : borderColor,
              boxShadow: (showPriorityDropdown || priorityIsFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
              outline: 'none',
            }}
          >
            <span>{{ LOW: '낮음', NORMAL: '보통', HIGH: '높음' }[formData.priority] || '보통'}</span>
            <ChevronDown size={16} style={{
              position: 'absolute', right: '12px', top: '50%',
              color: secondaryTextColor,
              transform: showPriorityDropdown ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
              transition: 'transform 0.2s',
            }} />
          </div>
          {showPriorityDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              marginTop: '4px', borderRadius: '8px', border: `1px solid ${borderColor}`,
              backgroundColor: cardBg, boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}>
              {priorityOptions.map((opt, idx) => (
                <div key={opt.value}
                  onClick={() => { onChange({ target: { name: 'priority', value: opt.value } }); setShowPriorityDropdown(false); }}
                  style={{
                    padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px', color: textColor,
                    backgroundColor: idx === priorityFocusedIdx
                      ? (isDarkMode ? '#1e293b' : '#f0f9ff')
                      : formData.priority === opt.value ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                  }}
                  onMouseEnter={() => setPriorityFocusedIdx(idx)}
                  onMouseLeave={(e) => { if (idx !== priorityFocusedIdx && formData.priority !== opt.value) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 일정 공유 */}
      {offices.length > 0 && onSharedTargetsChange && (
        <div style={{ marginBottom: '14px' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Share2 size={14} /> 일정 공유 (선택사항)
          </label>

          {/* 추가된 공유 대상 목록 */}
          {sharedTargets.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sharedTargets.map((target, idx) => (
                <span key={idx} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '16px',
                  backgroundColor: isDarkMode ? '#3b2f63' : '#ede9fe',
                  color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                  fontSize: '12px', fontWeight: '500'
                }}>
                  {target.officeName}
                  {target.departmentName && ` > ${target.departmentName}`}
                  {target.positions && target.positions.length > 0 && ` (${target.positions.join(', ')})`}
                  <span
                    onClick={() => handleRemoveShareTarget(idx)}
                    style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1, marginLeft: '4px' }}
                  >&times;</span>
                </span>
              ))}
            </div>
          )}

          {/* 공유 대상 추가 UI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* 처/실 선택 - 커스텀 드롭다운 */}
            <div ref={officeDropdownRef} style={{ position: 'relative' }}>
              <div
                onClick={() => setShowOfficeDropdown(!showOfficeDropdown)}
                style={{
                  ...uniformInputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingRight: '36px',
                  position: 'relative',
                  borderColor: showOfficeDropdown ? '#3B82F6' : borderColor,
                  boxShadow: showOfficeDropdown ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                }}
              >
                <span style={{ color: shareOfficeId ? textColor : secondaryTextColor }}>
                  {shareOfficeId ? offices.find(o => o.id === parseInt(shareOfficeId))?.name || '처/실 선택' : '처/실 선택'}
                </span>
                <ChevronDown size={16} style={{
                  position: 'absolute', right: '12px', top: '50%',
                  color: secondaryTextColor,
                  transform: showOfficeDropdown ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                  transition: 'transform 0.2s',
                }} />
              </div>
              {showOfficeDropdown && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 10,
                  marginBottom: '4px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                  backgroundColor: cardBg, boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
                  maxHeight: '160px', overflowY: 'auto',
                }}>
                  {offices.map((office) => (
                    <div key={office.id}
                      onClick={() => {
                        setShareOfficeId(String(office.id));
                        setShareDepartmentId('');
                        setSharePositions([]);
                        setShowOfficeDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px',
                        color: textColor,
                        backgroundColor: parseInt(shareOfficeId) === office.id ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (parseInt(shareOfficeId) !== office.id) e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5'; }}
                      onMouseLeave={(e) => { if (parseInt(shareOfficeId) !== office.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {office.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 부서 선택 (처/실 선택 시 표시) - 커스텀 드롭다운 */}
            {shareOfficeId && shareDepartments.length > 0 && (
              <div ref={departmentDropdownRef} style={{ position: 'relative' }}>
                <div
                  onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                  style={{
                    ...uniformInputStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: '36px',
                    position: 'relative',
                    borderColor: showDepartmentDropdown ? '#3B82F6' : borderColor,
                    boxShadow: showDepartmentDropdown ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                  }}
                >
                  <span style={{ color: shareDepartmentId ? textColor : secondaryTextColor }}>
                    {shareDepartmentId ? shareDepartments.find(d => d.id === parseInt(shareDepartmentId))?.name || '부서 전체' : '부서 전체'}
                  </span>
                  <ChevronDown size={16} style={{
                    position: 'absolute', right: '12px', top: '50%',
                    color: secondaryTextColor,
                    transform: showDepartmentDropdown ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                    transition: 'transform 0.2s',
                  }} />
                </div>
                {showDepartmentDropdown && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 10,
                    marginBottom: '4px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                    backgroundColor: cardBg, boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
                    maxHeight: '160px', overflowY: 'auto',
                  }}>
                    <div
                      onClick={() => { setShareDepartmentId(''); setShowDepartmentDropdown(false); }}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px',
                        color: textColor,
                        backgroundColor: !shareDepartmentId ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (shareDepartmentId) e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5'; }}
                      onMouseLeave={(e) => { if (shareDepartmentId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      부서 전체
                    </div>
                    {shareDepartments.map((dept) => (
                      <div key={dept.id}
                        onClick={() => { setShareDepartmentId(String(dept.id)); setShowDepartmentDropdown(false); }}
                        style={{
                          padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px',
                          color: textColor,
                          backgroundColor: parseInt(shareDepartmentId) === dept.id ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (parseInt(shareDepartmentId) !== dept.id) e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5'; }}
                        onMouseLeave={(e) => { if (parseInt(shareDepartmentId) !== dept.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {dept.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 직급 선택 (처/실 선택 시 표시) - 커스텀 드롭다운 */}
            {shareOfficeId && (
              <div ref={positionDropdownRef} style={{ position: 'relative' }}>
                <div
                  onClick={() => setShowPositionDropdown(!showPositionDropdown)}
                  style={{
                    ...uniformInputStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingRight: '36px',
                    position: 'relative',
                    borderColor: showPositionDropdown ? '#3B82F6' : borderColor,
                    boxShadow: showPositionDropdown ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                  }}
                >
                  <span style={{ color: sharePositions.length > 0 ? textColor : secondaryTextColor }}>
                    {getDisplayPositions()}
                  </span>
                  <ChevronDown size={16} style={{
                    position: 'absolute', right: '12px', top: '50%',
                    color: secondaryTextColor,
                    transform: showPositionDropdown ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                    transition: 'transform 0.2s',
                  }} />
                </div>
                {showPositionDropdown && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 10,
                    marginBottom: '4px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                    backgroundColor: cardBg, boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
                    maxHeight: '160px', overflowY: 'auto',
                  }}>
                    {POSITION_OPTIONS.map((pos) => {
                      const selected = isPositionSelected(pos.value);
                      return (
                        <div key={pos.value}
                          onClick={() => toggleSharePosition(pos.value)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px',
                            color: textColor,
                            backgroundColor: selected ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                            display: 'flex', alignItems: 'center', gap: '8px',
                          }}
                          onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5'; }}
                          onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '3px',
                            border: `2px solid ${selected ? '#3B82F6' : borderColor}`,
                            backgroundColor: selected ? '#3B82F6' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selected && (
                              <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                            )}
                          </div>
                          {pos.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 추가 버튼 */}
            {shareOfficeId && (
              <button
                type="button"
                onClick={handleAddShareTarget}
                style={{
                  padding: '8px 16px', borderRadius: '6px',
                  backgroundColor: '#3B82F6', color: '#fff', border: 'none',
                  fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                추가
              </button>
            )}
          </div>

          <p style={{ marginTop: '8px', fontSize: '12px', color: secondaryTextColor, fontFamily }}>
            {sharedTargets.length > 0
              ? `${sharedTargets.length}개 공유 대상이 이 일정을 볼 수 있습니다.`
              : '같은 부서원은 항상 볼 수 있습니다.'}
          </p>
        </div>
      )}

      {/* 반복 일정 설정 */}
      {(() => {
        const isRecurringThisOnly = editType === 'this' && (event?.isRecurring || event?.seriesId);
        const canToggleRecurring = !isRecurringThisOnly && onRecurringToggle;

        return (
          <>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: canToggleRecurring ? 'pointer' : 'default', fontFamily
              }}>
                <input
                  type="checkbox"
                  checked={!!formData.isRecurring}
                  onChange={canToggleRecurring ? onRecurringToggle : undefined}
                  disabled={!canToggleRecurring}
                  style={{ width: '18px', height: '18px', cursor: canToggleRecurring ? 'pointer' : 'default', accentColor: '#3B82F6' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>
                  반복 일정으로 등록
                  {isRecurringThisOnly && (
                    <span style={{ fontSize: '12px', color: secondaryTextColor, fontWeight: '400', marginLeft: '8px' }}>
                      (전체 수정에서 변경 가능)
                    </span>
                  )}
                </span>
              </label>
            </div>

            {formData.isRecurring && !isRecurringThisOnly && (
              <div style={{
                padding: '14px', borderRadius: '10px', backgroundColor: bgColor,
                marginBottom: '16px', border: `1px solid ${borderColor}`
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>반복 주기</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number" name="recurrenceInterval" value={formData.recurrenceInterval}
                      onChange={onChange} min="1" max="99"
                      style={{ ...inputStyle, width: '80px', textAlign: 'center' }}
                    />
                    <select
                      name="recurrenceType" value={formData.recurrenceType} onChange={onChange}
                      style={{ ...inputStyle, width: 'auto', flex: 1, cursor: 'pointer' }}
                    >
                      <option value="day">일마다</option>
                      <option value="week">주마다</option>
                      <option value="month">개월마다</option>
                      <option value="year">년마다</option>
                    </select>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '13px', color: secondaryTextColor, fontFamily }}>
                    {formData.recurrenceInterval === '1' || formData.recurrenceInterval === 1
                      ? `매${formData.recurrenceType === 'day' ? '일' : formData.recurrenceType === 'week' ? '주' : formData.recurrenceType === 'month' ? '월' : '년'} 반복`
                      : `${formData.recurrenceInterval}${formData.recurrenceType === 'day' ? '일' : formData.recurrenceType === 'week' ? '주' : formData.recurrenceType === 'month' ? '개월' : '년'}마다 반복`}
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>반복 종료일 *</label>
                  <input
                    type="date" name="recurrenceEndDate" value={formData.recurrenceEndDate}
                    onChange={onChange} required={formData.isRecurring} min={formData.startDate}
                    style={dateInputStyle}
                  />
                  <p style={{ marginTop: '8px', fontSize: '13px', color: secondaryTextColor, fontFamily }}>이 날짜까지 반복됩니다</p>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {rateLimitCountdown > 0 ? (
        <div style={{
          padding: '12px', borderRadius: '8px',
          backgroundColor: isDarkMode ? '#7f1d1d' : '#fef2f2',
          color: isDarkMode ? '#fca5a5' : '#dc2626',
          fontSize: '14px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <span>요청이 너무 많습니다. 잠시 후 다시 시도해주세요.</span>
          <span style={{
            fontWeight: '700', fontSize: '13px',
            backgroundColor: isDarkMode ? '#dc2626' : '#ef4444',
            color: '#fff', borderRadius: '12px', padding: '2px 10px', minWidth: '28px',
            textAlign: 'center', display: 'inline-block',
          }}>
            {rateLimitCountdown}
          </span>
        </div>
      ) : (
        <ErrorAlert message={error} />
      )}

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column-reverse' : 'row',
        gap: '10px',
        justifyContent: 'flex-end',
        marginTop: '4px',
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
      }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding: isMobile ? '12px 20px' : '10px 20px', borderRadius: '8px', border: `1px solid ${borderColor}`,
            backgroundColor: 'transparent', color: textColor, cursor: 'pointer',
            fontSize: '14px', fontWeight: '500', fontFamily,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          취소
        </button>
        <button
          type="submit" disabled={loading || actionInProgress || rateLimitCountdown > 0}
          style={{
            padding: isMobile ? '12px 20px' : '10px 20px', borderRadius: '8px', border: 'none',
            backgroundColor: (loading || actionInProgress || rateLimitCountdown > 0) ? '#1e40af' : '#3B82F6',
            color: '#fff', cursor: (loading || actionInProgress || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: '500', fontFamily,
            opacity: (loading || actionInProgress || rateLimitCountdown > 0) ? 0.5 : 1,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {(loading || actionInProgress) ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
