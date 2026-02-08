import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Share2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';
import api from '../../utils/api';

const getInitialFormData = (selectedDate) => {
  const dateStr = selectedDate || new Date().toISOString().split('T')[0];
  const baseDate = new Date(dateStr + 'T00:00:00');
  const oneMonthLater = new Date(baseDate);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const endDateStr = `${oneMonthLater.getFullYear()}-${String(oneMonthLater.getMonth() + 1).padStart(2, '0')}-${String(oneMonthLater.getDate()).padStart(2, '0')}`;

  return {
    title: '',
    content: '',
    startDate: dateStr,
    startTime: '09:00',
    endDate: dateStr,
    endTime: '18:00',
    priority: 'NORMAL',
    isRecurring: false,
    recurrenceType: 'week',
    recurrenceInterval: 1,
    recurrenceEndDate: endDateStr
  };
};

export default function EventModal({ isOpen, onClose, onSuccess, selectedDate, rateLimitCountdown = 0, onRateLimitStart }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => getInitialFormData(selectedDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offices, setOffices] = useState([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [priorityFocusedIdx, setPriorityFocusedIdx] = useState(-1);
  const [officeFocusedIdx, setOfficeFocusedIdx] = useState(-1);
  const officeDropdownRef = useRef(null);
  const priorityDropdownRef = useRef(null);

  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const isMobile = useIsMobile();
  const { fontFamily, inputStyle, labelStyle } = useCommonStyles();

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(selectedDate));
      setError('');
      setLoading(false);
      setSelectedOfficeIds([]);
      setShowOfficeDropdown(false);
      setShowPriorityDropdown(false);
      // 처/실 목록 로드
      if (user?.divisionId) {
        api.getOffices(user.divisionId).then(data => {
          const list = data?.offices || data || [];
          setOffices(Array.isArray(list) ? list : []);
        }).catch(() => {});
      }
    }
  }, [isOpen, selectedDate, user?.divisionId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (officeDropdownRef.current && !officeDropdownRef.current.contains(e.target)) {
        setShowOfficeDropdown(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target)) {
        setShowPriorityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC 키로 모달 닫기
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  // 모달 애니메이션
  const [isAnimating, setIsAnimating] = useState(false);
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleOffice = (officeId) => {
    setSelectedOfficeIds(prev =>
      prev.includes(officeId) ? prev.filter(id => id !== officeId) : [...prev, officeId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const startAt = `${formData.startDate}T${formData.startTime}:00`;
      const endAt = `${formData.endDate}T${formData.endTime}:00`;

      if (new Date(endAt) <= new Date(startAt)) {
        setError('종료 시간은 시작 시간보다 이후여야 합니다.');
        setLoading(false);
        return;
      }

      const eventData = {
        title: formData.title,
        content: formData.content,
        startAt,
        endAt,
        priority: formData.priority
      };

      if (selectedOfficeIds.length > 0) {
        eventData.sharedOfficeIds = selectedOfficeIds;
      }

      if (formData.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurrenceType = formData.recurrenceType;
        eventData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
        eventData.recurrenceEndDate = formData.recurrenceEndDate;
      }

      await api.createEvent(eventData);
      setFormData(getInitialFormData(selectedDate));
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.message || '일정 생성에 실패했습니다.';
      setError(msg);
      if ((msg.includes('너무 많은 요청') || msg.includes('RATE_LIMIT')) && onRateLimitStart) onRateLimitStart(60);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isAnimating ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '5px',
        transition: 'background-color 0.2s ease',
      }}
    >
      <div style={{
        backgroundColor: cardBg,
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '600px',
        maxHeight: isMobile ? '92vh' : 'calc(100vh - 10px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily,
        transform: isAnimating ? 'translateY(0)' : (isMobile ? 'translateY(100%)' : 'translateY(20px)'),
        opacity: isMobile ? 1 : (isAnimating ? 1 : 0),
        transition: isMobile ? 'transform 0.3s ease' : 'transform 0.25s ease, opacity 0.2s ease',
      }}>
        {/* Header - sticky */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '2px', flexShrink: 0 }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: isDarkMode ? '#4a5568' : '#cbd5e0' }} />
          </div>
        )}
        <div style={{
          padding: isMobile ? '12px 20px' : '24px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, backgroundColor: cardBg, zIndex: 1,
        }}>
          <h2 id="event-modal-title" style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '600', margin: 0, color: textColor, flex: 1, minWidth: 0 }}>{isMobile ? '새 일정' : '새 일정 만들기'}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: textColor, cursor: 'pointer'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Body - scrollable */}
        <form onSubmit={handleSubmit} style={{ padding: isMobile ? '16px 20px 20px' : '20px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {/* 작성자 정보 (필요 시 주석 해제)
          <div style={{
            padding: '8px 12px', borderRadius: '8px', backgroundColor: bgColor,
            marginBottom: '14px', fontSize: '13px', color: secondaryTextColor
          }}>
            <strong style={{ color: textColor }}>작성자:</strong> {user?.division} {user?.office} {user?.department} {user?.position} {user?.name}
          </div>
          */}

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>제목 *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} required autoFocus style={uniformInputStyle} placeholder="일정 제목을 입력하세요" />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>내용</label>
            <textarea name="content" value={formData.content} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="일정 내용을 입력하세요" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>시작 날짜 *</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required style={dateInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>시작 시간 *</label>
              <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required style={dateInputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>종료 날짜 *</label>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required style={dateInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>종료 시간 *</label>
              <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required style={dateInputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>우선순위</label>
            <div ref={priorityDropdownRef} style={{ position: 'relative' }}>
              <div
                tabIndex={0}
                onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); const opts = [{ value: 'LOW' }, { value: 'NORMAL' }, { value: 'HIGH' }]; const idx = opts.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); }}
                onKeyDown={(e) => {
                  const opts = [{ value: 'LOW', label: '낮음' }, { value: 'NORMAL', label: '보통' }, { value: 'HIGH', label: '높음' }];
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (showPriorityDropdown && priorityFocusedIdx >= 0) {
                      setFormData({ ...formData, priority: opts[priorityFocusedIdx].value });
                      setShowPriorityDropdown(false);
                    } else {
                      setShowPriorityDropdown(!showPriorityDropdown);
                      const idx = opts.findIndex(o => o.value === formData.priority);
                      setPriorityFocusedIdx(idx >= 0 ? idx : 0);
                    }
                  } else if (e.key === 'Escape') { setShowPriorityDropdown(false); }
                  else if (e.key === 'ArrowDown') { e.preventDefault(); if (!showPriorityDropdown) { setShowPriorityDropdown(true); const idx = opts.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); } else { setPriorityFocusedIdx(prev => Math.min(prev + 1, opts.length - 1)); } }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); if (!showPriorityDropdown) { setShowPriorityDropdown(true); const idx = opts.findIndex(o => o.value === formData.priority); setPriorityFocusedIdx(idx >= 0 ? idx : 0); } else { setPriorityFocusedIdx(prev => Math.max(prev - 1, 0)); } }
                  else if (e.key === 'Tab') { if (showPriorityDropdown) setShowPriorityDropdown(false); }
                }}
                style={{
                  ...uniformInputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingRight: '36px',
                  position: 'relative',
                  borderColor: showPriorityDropdown ? '#3B82F6' : borderColor,
                  boxShadow: showPriorityDropdown ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                  outline: 'none',
                }}
              >
                <span>{{ LOW: '낮음', NORMAL: '보통', HIGH: '높음' }[formData.priority]}</span>
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
                  {[{ value: 'LOW', label: '낮음' }, { value: 'NORMAL', label: '보통' }, { value: 'HIGH', label: '높음' }].map((opt, idx) => (
                    <div key={opt.value}
                      onClick={() => { setFormData({ ...formData, priority: opt.value }); setShowPriorityDropdown(false); }}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', fontFamily, fontSize: '14px', color: textColor,
                        backgroundColor: idx === priorityFocusedIdx
                          ? (isDarkMode ? '#1e293b' : '#f0f9ff')
                          : formData.priority === opt.value ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent',
                      }}
                      onMouseEnter={(e) => { setPriorityFocusedIdx(idx); if (formData.priority !== opt.value) e.currentTarget.style.backgroundColor = isDarkMode ? '#1e293b' : '#f5f5f5'; }}
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
          {offices.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Share2 size={14} /> 일정 공유 (선택사항)
              </label>
              <div ref={officeDropdownRef} style={{ position: 'relative' }}>
                <div
                  tabIndex={0}
                  onClick={() => { setShowOfficeDropdown(!showOfficeDropdown); setOfficeFocusedIdx(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (showOfficeDropdown && officeFocusedIdx >= 0 && officeFocusedIdx < offices.length) {
                        toggleOffice(offices[officeFocusedIdx].id);
                      } else {
                        setShowOfficeDropdown(!showOfficeDropdown); setOfficeFocusedIdx(0);
                      }
                    } else if (e.key === 'Escape') { setShowOfficeDropdown(false); }
                    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!showOfficeDropdown) { setShowOfficeDropdown(true); setOfficeFocusedIdx(0); } else { setOfficeFocusedIdx(prev => Math.min(prev + 1, offices.length - 1)); } }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!showOfficeDropdown) { setShowOfficeDropdown(true); setOfficeFocusedIdx(0); } else { setOfficeFocusedIdx(prev => Math.max(prev - 1, 0)); } }
                    else if (e.key === 'Tab') { if (showOfficeDropdown) setShowOfficeDropdown(false); }
                  }}
                  style={{
                    ...uniformInputStyle,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: fieldHeight,
                    height: 'auto',
                    paddingRight: '36px',
                    position: 'relative',
                    flexWrap: 'wrap',
                    gap: '4px',
                    borderColor: showOfficeDropdown ? '#3B82F6' : borderColor,
                    boxShadow: showOfficeDropdown ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
                    outline: 'none',
                  }}
                >
                  {selectedOfficeIds.length > 0 ? (
                    selectedOfficeIds.map(id => {
                      const office = offices.find(o => o.id === id);
                      return office ? (
                        <span key={id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '12px',
                          backgroundColor: isDarkMode ? '#3b2f63' : '#ede9fe',
                          color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                          fontSize: '12px', fontWeight: '500'
                        }}>
                          {office.name}
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleOffice(id); }}
                            style={{ cursor: 'pointer', fontSize: '14px', lineHeight: 1, marginLeft: '2px' }}
                          >&times;</span>
                        </span>
                      ) : null;
                    })
                  ) : (
                    <span style={{ color: secondaryTextColor, fontSize: '14px' }}>공유할 처/실을 선택하세요</span>
                  )}
                  <ChevronDown size={16} style={{
                    position: 'absolute', right: '12px', top: '50%',
                    color: secondaryTextColor,
                    transform: showOfficeDropdown ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
                    transition: 'transform 0.2s'
                  }} />
                </div>
                {showOfficeDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    marginTop: '4px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                    backgroundColor: cardBg, boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
                    maxHeight: '120px', overflowY: 'auto'
                  }}>
                    {offices.map((office, idx) => (
                      <label key={office.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                        cursor: 'pointer', fontFamily, fontSize: '14px', color: textColor,
                        backgroundColor: idx === officeFocusedIdx
                          ? (isDarkMode ? '#1e293b' : '#f0f9ff')
                          : selectedOfficeIds.includes(office.id) ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent'
                      }}
                        onMouseEnter={() => setOfficeFocusedIdx(idx)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOfficeIds.includes(office.id)}
                          onChange={() => toggleOffice(office.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                        />
                        {office.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ marginTop: '6px', fontSize: '12px', color: secondaryTextColor, fontFamily, paddingLeft: '14px' }}>
                {selectedOfficeIds.length > 0
                  ? `${selectedOfficeIds.length}개 처/실 소속 전원이 이 일정을 볼 수 있습니다.`
                  : '같은 부서원은 항상 볼 수 있습니다.'}
              </p>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontFamily }}>
              <input
                type="checkbox" name="isRecurring" checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3B82F6' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>반복 일정으로 등록</span>
            </label>
          </div>

          {formData.isRecurring && (
            <div style={{
              padding: '14px', borderRadius: '10px', backgroundColor: bgColor,
              marginBottom: '16px', border: `1px solid ${borderColor}`
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>반복 주기</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input type="number" name="recurrenceInterval" value={formData.recurrenceInterval} onChange={handleChange} min="1" max="99" style={{ ...inputStyle, width: '80px', textAlign: 'center' }} />
                  <select name="recurrenceType" value={formData.recurrenceType} onChange={handleChange} style={{ ...inputStyle, width: 'auto', flex: 1 }}>
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
                <input type="date" name="recurrenceEndDate" value={formData.recurrenceEndDate} onChange={handleChange} required={formData.isRecurring} min={formData.startDate} style={dateInputStyle} />
                <p style={{ marginTop: '8px', fontSize: '13px', color: secondaryTextColor, fontFamily }}>이 날짜까지 반복됩니다</p>
              </div>
            </div>
          )}

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
            <button type="button" onClick={onClose} style={{
              padding: isMobile ? '12px 20px' : '10px 20px', borderRadius: '8px', border: `1px solid ${borderColor}`,
              backgroundColor: 'transparent', color: textColor, cursor: 'pointer', fontSize: '14px', fontWeight: '500', fontFamily,
              width: isMobile ? '100%' : 'auto',
            }}>취소</button>
            <button type="submit" disabled={loading || rateLimitCountdown > 0} style={{
              padding: isMobile ? '12px 20px' : '10px 20px', borderRadius: '8px', border: 'none',
              backgroundColor: (loading || rateLimitCountdown > 0) ? '#1e40af' : '#3B82F6', color: '#fff',
              cursor: (loading || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', fontFamily,
              opacity: (loading || rateLimitCountdown > 0) ? 0.5 : 1,
              width: isMobile ? '100%' : 'auto',
            }}>{loading ? '생성 중...' : '일정 만들기'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
