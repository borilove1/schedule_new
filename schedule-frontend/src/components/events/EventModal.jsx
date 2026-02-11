import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Share2, ChevronDown, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import { useSwipeDown } from '../../hooks/useSwipeDown';
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

// 직급 옵션 - 처/실명, 부서명에 따라 동적으로 결정
// 직할 부서: 해당 장급만 표시 (실장/처장/지사장)
// 일반 부서 또는 부서 전체: 부장, 차장, 직원
const getPositionOptions = (officeName, departmentName) => {
  const deptName = departmentName || '';
  const offName = officeName || '';

  // 직할인 경우 특별 처리 (부서명 또는 처/실명에 '직할' 포함)
  if (deptName.includes('직할') || offName.includes('직할')) {
    // 1. 본부 직할 -> 본부장
    if (deptName.includes('본부') || offName.includes('본부')) {
      return [{ value: '본부장', label: '본부장' }];
    }
    // 2. 처 직할 (사업처, 관리처 등) -> 처장
    if (deptName.includes('처') || offName.includes('처')) {
      return [{ value: '처장', label: '처장' }];
    }
    // 3. 실 직할 (기획관리실 등) -> 실장
    if (deptName.includes('실') || offName.includes('실')) {
      return [{ value: '실장', label: '실장' }];
    }
    // 4. 지사인 경우
    if (deptName.includes('지사') || offName.includes('지사')) {
      return [{ value: '지사장', label: '지사장' }];
    }
    // 기본값 (기타 직할)
    return [{ value: '본부장', label: '본부장' }];
  }

  const baseOptions = [
    { value: '부장', label: '부장' },
    { value: '차장', label: '차장' },
    { value: 'staff', label: '직원', includes: ['사원', '대리', '과장'] },
  ];

  // 일반 부서 선택한 경우
  if (deptName) {
    return baseOptions;
  }

  // 처/실만 선택한 경우 (부서 전체): 일반 직급만 (실장/처장은 직할 부서에서만)
  if (offName) {
    return baseOptions;
  }

  return baseOptions;
};

export default function EventModal({ isOpen, onClose, onSuccess, selectedDate, rateLimitCountdown = 0, onRateLimitStart }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => getInitialFormData(selectedDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offices, setOffices] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const fileInputRef = useRef(null);

  // 공유 대상 관련 상태
  const [sharedTargets, setSharedTargets] = useState([]); // [{ officeId, officeName, departmentId, departmentName, positions }]
  const [shareOfficeId, setShareOfficeId] = useState('');
  const [shareDepartmentId, setShareDepartmentId] = useState('');
  const [sharePositions, setSharePositions] = useState([]);
  const [shareDepartments, setShareDepartments] = useState([]);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showPositionDropdown, setShowPositionDropdown] = useState(false);
  const officeDropdownRef = useRef(null);
  const departmentDropdownRef = useRef(null);
  const positionDropdownRef = useRef(null);

  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [priorityFocusedIdx, setPriorityFocusedIdx] = useState(-1);
  const [priorityIsFocused, setPriorityIsFocused] = useState(false);
  const priorityDropdownRef = useRef(null);

  // 일정 공유 드롭다운 포커스 상태
  const [officeIsFocused, setOfficeIsFocused] = useState(false);
  const [departmentIsFocused, setDepartmentIsFocused] = useState(false);
  const [positionIsFocused, setPositionIsFocused] = useState(false);

  const { isDarkMode, bgColor, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const isMobile = useIsMobile();
  const { fontFamily, inputStyle, labelStyle } = useCommonStyles();

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(selectedDate));
      setError('');
      setLoading(false);
      setAttachedFiles([]);
      // 공유 대상 초기화
      setSharedTargets([]);
      setShareOfficeId('');
      setShareDepartmentId('');
      setSharePositions([]);
      setShareDepartments([]);
      setShowShareOptions(false);
      setShowPriorityDropdown(false);
      setShowOfficeDropdown(false);
      setShowDepartmentDropdown(false);
      setShowPositionDropdown(false);
      // 처/실 목록 로드
      if (user?.divisionId) {
        api.getOffices(user.divisionId).then(data => {
          const list = data?.offices || data || [];
          setOffices(Array.isArray(list) ? list : []);
        }).catch(() => {});
      }
    }
  }, [isOpen, selectedDate, user?.divisionId]);

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

  // 부서 선택 시 처장/실장이 선택되어 있으면 제거 (부서에는 처장/실장이 없으므로)
  useEffect(() => {
    if (shareDepartmentId) {
      setSharePositions(prev => prev.filter(p => !['처장', '실장'].includes(p)));
    }
  }, [shareDepartmentId]);

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
      setSharedTargets([...sharedTargets, newTarget]);
    }

    // 입력 필드 초기화
    setShareOfficeId('');
    setShareDepartmentId('');
    setSharePositions([]);
  };

  // 공유 대상 제거
  const handleRemoveShareTarget = (index) => {
    setSharedTargets(sharedTargets.filter((_, i) => i !== index));
  };

  // 현재 직급 옵션 (처/실명, 부서명에 따라 동적)
  const selectedOfficeName = shareOfficeId ? offices.find(o => o.id === parseInt(shareOfficeId))?.name : '';
  const selectedDepartmentName = shareDepartmentId ? shareDepartments.find(d => d.id === parseInt(shareDepartmentId))?.name : '';
  const positionOptions = getPositionOptions(selectedOfficeName, selectedDepartmentName);

  // 직급 토글 (직원/처/실장 선택 시 포함된 직급 한꺼번에 토글)
  const toggleSharePosition = (position) => {
    const opt = positionOptions.find(o => o.value === position);
    if (opt?.includes) {
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

  // 직급이 선택되었는지 확인
  const isPositionSelected = (position) => {
    const opt = positionOptions.find(o => o.value === position);
    if (opt?.includes) {
      return opt.includes.every(p => sharePositions.includes(p));
    }
    return sharePositions.includes(position);
  };

  // 표시용 직급 문자열
  const getDisplayPositions = () => {
    if (sharePositions.length === 0) return '직급 전체';
    const staffPositions = ['사원', '대리', '과장'];
    const chiefPositions = ['처장', '실장'];
    const hasAllStaff = staffPositions.every(p => sharePositions.includes(p));
    const hasAllChief = chiefPositions.every(p => sharePositions.includes(p));

    let display = sharePositions.filter(p => !staffPositions.includes(p) && !chiefPositions.includes(p));
    if (hasAllChief) display.push('처/실장');
    else display.push(...sharePositions.filter(p => chiefPositions.includes(p)));
    if (hasAllStaff) display.push('직원');
    else display.push(...sharePositions.filter(p => staffPositions.includes(p)));

    return display.join(', ');
  };

  // 모달 애니메이션
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsAnimating(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // transition 시간과 동일
  }, [isClosing, onClose]);

  // 스와이프로 모달 닫기
  const { handleTouchStart, handleTouchMove, handleTouchEnd, swipeStyle, backdropOpacity, contentRef: swipeContentRef } = useSwipeDown(onClose);

  // ESC 키로 모달 닫기
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') handleClose();
  }, [handleClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  // 모달이 닫히면 애니메이션 상태 초기화 (스와이프 닫기 포함)
  useEffect(() => {
    if (!isOpen) {
      setIsAnimating(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isClosing) {
      // 이중 rAF로 초기 상태 렌더 후 애니메이션 시작
      let raf2;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsAnimating(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
  }, [isOpen, isClosing]);

  if (!isOpen && !isClosing) return null;

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

      // 공유 대상 추가 (새 형식)
      if (sharedTargets.length > 0) {
        eventData.sharedTargets = sharedTargets.map(t => ({
          officeId: t.officeId,
          departmentId: t.departmentId,
          positions: t.positions
        }));
      }

      if (formData.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurrenceType = formData.recurrenceType;
        eventData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
        eventData.recurrenceEndDate = formData.recurrenceEndDate;
      }

      const result = await api.createEvent(eventData);

      // Upload attachments if any
      if (attachedFiles.length > 0) {
        let uploadId;
        if (result?.series?.id) uploadId = `series-${result.series.id}`;
        else if (result?.event?.id) uploadId = result.event.id;
        else if (result?.id) uploadId = result.id;
        if (uploadId) {
          try {
            await api.uploadAttachments(uploadId, attachedFiles);
          } catch (uploadErr) {
            console.error('첨부파일 업로드 실패:', uploadErr);
          }
        }
      }

      setAttachedFiles([]);
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
        backgroundColor: (isMobile && swipeStyle)
          ? `rgba(0,0,0,${0.7 * backdropOpacity})`
          : (isAnimating ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)'),
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : '5px',
        paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : '5px',
        transition: (isMobile && swipeStyle) ? 'none' : 'background-color 0.2s ease',
      }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
        backgroundColor: cardBg,
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '600px',
        maxHeight: isMobile ? 'calc(100% - env(safe-area-inset-top, 0px))' : 'calc(100vh - 10px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily,
        transform: (isMobile && swipeStyle) ? swipeStyle.transform : (isAnimating ? 'translateY(0)' : (isMobile ? 'translateY(100%)' : 'translateY(20px)')),
        opacity: isMobile ? 1 : (isAnimating ? 1 : 0),
        transition: (isMobile && swipeStyle) ? swipeStyle.transition : (isMobile ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'transform 0.25s ease, opacity 0.2s ease'),
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
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', color: textColor, cursor: 'pointer'
          }}>
            <X size={24} />
          </button>
        </div>

        {/* Body - scrollable */}
        <form ref={swipeContentRef} onSubmit={handleSubmit} style={{ padding: isMobile ? '12px 16px 16px' : '20px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {/* 작성자 정보 (필요 시 주석 해제)
          <div style={{
            padding: '8px 12px', borderRadius: '8px', backgroundColor: bgColor,
            marginBottom: '14px', fontSize: '13px', color: secondaryTextColor
          }}>
            <strong style={{ color: textColor }}>작성자:</strong> {user?.division} {user?.office} {user?.department} {user?.position} {user?.name}
          </div>
          */}

          <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
            <label style={labelStyle}>제목 *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} required autoFocus={!isMobile} style={uniformInputStyle} placeholder="일정 제목을 입력하세요" />
          </div>

          <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
            <label style={labelStyle}>내용</label>
            <textarea name="content" value={formData.content} onChange={handleChange} rows={isMobile ? 2 : 3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="일정 내용을 입력하세요" />
          </div>

          {/* 첨부파일 */}
          <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Paperclip size={14} /> 첨부파일 (선택사항)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files);
                const maxFiles = 5 - attachedFiles.length;
                if (maxFiles <= 0) {
                  setError('첨부파일은 최대 5개까지 가능합니다.');
                  e.target.value = '';
                  return;
                }
                const validFiles = files.slice(0, maxFiles).filter(f => f.size <= 20 * 1024 * 1024);
                if (validFiles.length < files.slice(0, maxFiles).length) {
                  setError('일부 파일이 크기 제한(20MB)을 초과하여 제외되었습니다.');
                }
                setAttachedFiles(prev => [...prev, ...validFiles]);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachedFiles.length >= 5}
              style={{
                padding: '8px 16px', borderRadius: '8px',
                border: `1px dashed ${borderColor}`,
                backgroundColor: 'transparent', color: secondaryTextColor,
                cursor: attachedFiles.length >= 5 ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: '500',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily, opacity: attachedFiles.length >= 5 ? 0.5 : 1,
              }}
            >
              <Paperclip size={14} />
              파일 선택 (최대 5개, 각 20MB)
            </button>
            {attachedFiles.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {attachedFiles.map((file, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', borderRadius: '6px',
                    backgroundColor: bgColor, fontSize: '13px',
                  }}>
                    <Paperclip size={12} color={secondaryTextColor} style={{ flexShrink: 0 }} />
                    <span style={{ color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {file.name}
                    </span>
                    <span style={{ color: secondaryTextColor, fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(file.size / 1024)}KB`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 4px', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '10px' : '14px' }}>
            <div>
              <label style={labelStyle}>시작 날짜 *</label>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required style={dateInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>시작 시간 *</label>
              <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required style={dateInputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '10px' : '14px' }}>
            <div>
              <label style={labelStyle}>종료 날짜 *</label>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required style={dateInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>종료 시간 *</label>
              <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required style={dateInputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
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
            <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
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
                    tabIndex={0}
                    onClick={() => setShowOfficeDropdown(!showOfficeDropdown)}
                    onFocus={() => setOfficeIsFocused(true)}
                    onBlur={() => setOfficeIsFocused(false)}
                    style={{
                      ...uniformInputStyle,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingRight: '36px',
                      position: 'relative',
                      borderColor: (showOfficeDropdown || officeIsFocused) ? '#3B82F6' : borderColor,
                      boxShadow: (showOfficeDropdown || officeIsFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
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
                      tabIndex={0}
                      onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                      onFocus={() => setDepartmentIsFocused(true)}
                      onBlur={() => setDepartmentIsFocused(false)}
                      style={{
                        ...uniformInputStyle,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingRight: '36px',
                        position: 'relative',
                        borderColor: (showDepartmentDropdown || departmentIsFocused) ? '#3B82F6' : borderColor,
                        boxShadow: (showDepartmentDropdown || departmentIsFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
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
                      tabIndex={0}
                      onClick={() => setShowPositionDropdown(!showPositionDropdown)}
                      onFocus={() => setPositionIsFocused(true)}
                      onBlur={() => setPositionIsFocused(false)}
                      style={{
                        ...uniformInputStyle,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingRight: '36px',
                        position: 'relative',
                        borderColor: (showPositionDropdown || positionIsFocused) ? '#3B82F6' : borderColor,
                        boxShadow: (showPositionDropdown || positionIsFocused) ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
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
                        {positionOptions.map((pos) => {
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

          <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
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
