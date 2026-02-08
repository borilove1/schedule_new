import React, { useState, useRef, useEffect } from 'react';
import { Share2, ChevronDown, Repeat } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';
import ErrorAlert from '../common/ErrorAlert';

export default function EventEditForm({
  formData, onChange, onSubmit, onCancel, editType, event, loading, actionInProgress, error,
  offices = [], selectedOfficeIds = [], onOfficeToggle, onRecurringToggle, rateLimitCountdown = 0
}) {
  const { isDarkMode, inputBg, borderColor, textColor, cardBg, bgColor, secondaryTextColor } = useThemeColors();
  const { inputStyle, labelStyle, fontFamily } = useCommonStyles();
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const officeDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (officeDropdownRef.current && !officeDropdownRef.current.contains(e.target)) {
        setShowOfficeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <form onSubmit={onSubmit}>
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>제목 *</label>
        <input type="text" name="title" value={formData.title} onChange={onChange} required style={{ ...inputStyle, boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>내용</label>
        <textarea name="content" value={formData.content} onChange={onChange} rows={4} style={{ ...inputStyle, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={labelStyle}>시작 날짜 *</label>
          <input type="date" name="startDate" value={formData.startDate} onChange={onChange} required style={{ ...inputStyle, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={labelStyle}>시작 시간 *</label>
          <input type="time" name="startTime" value={formData.startTime} onChange={onChange} required style={{ ...inputStyle, boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={labelStyle}>종료 날짜 *</label>
          <input type="date" name="endDate" value={formData.endDate} onChange={onChange} required style={{ ...inputStyle, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={labelStyle}>종료 시간 *</label>
          <input type="time" name="endTime" value={formData.endTime} onChange={onChange} required style={{ ...inputStyle, boxSizing: 'border-box' }} />
        </div>
      </div>

      {(() => {
        // 반복 일정 "이번만 수정"이면 반복 설정 변경 불가
        const isRecurringThisOnly = editType === 'this' && (event?.isRecurring || event?.seriesId);
        const canToggleRecurring = !isRecurringThisOnly && onRecurringToggle;

        return (
          <div style={{
            padding: '16px 20px', borderRadius: '12px', backgroundColor: inputBg,
            marginBottom: '24px', border: `1px solid ${borderColor}`
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              cursor: canToggleRecurring ? 'pointer' : 'default',
              fontFamily, fontSize: '14px', fontWeight: '500', color: textColor
            }}>
              <input
                type="checkbox"
                checked={!!formData.isRecurring}
                onChange={canToggleRecurring ? onRecurringToggle : undefined}
                disabled={!canToggleRecurring}
                style={{ width: '18px', height: '18px', cursor: canToggleRecurring ? 'pointer' : 'default', accentColor: '#3B82F6' }}
              />
              <Repeat size={16} />
              반복 일정
              {isRecurringThisOnly && (
                <span style={{ fontSize: '12px', color: secondaryTextColor, fontWeight: '400' }}>
                  (전체 수정에서 변경 가능)
                </span>
              )}
            </label>

            {formData.isRecurring && !isRecurringThisOnly && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>반복 주기</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number" name="recurrenceInterval" value={formData.recurrenceInterval}
                      onChange={onChange} min="1" max="99"
                      style={{ ...inputStyle, width: '80px', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <select
                      name="recurrenceType" value={formData.recurrenceType} onChange={onChange}
                      style={{ ...inputStyle, width: 'auto', flex: 1, boxSizing: 'border-box', cursor: 'pointer' }}
                    >
                      <option value="day">일마다</option>
                      <option value="week">주마다</option>
                      <option value="month">개월마다</option>
                      <option value="year">년마다</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>반복 종료일</label>
                  <input
                    type="date" name="recurrenceEndDate" value={formData.recurrenceEndDate}
                    onChange={onChange} style={{ ...inputStyle, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {offices.length > 0 && onOfficeToggle && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Share2 size={14} /> 일정 공유 (선택사항)
          </label>
          <div ref={officeDropdownRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowOfficeDropdown(!showOfficeDropdown)}
              style={{
                ...inputStyle,
                boxSizing: 'border-box',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                minHeight: '44px',
                paddingRight: '36px',
                position: 'relative',
                flexWrap: 'wrap',
                gap: '4px'
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
                        onClick={(e) => { e.stopPropagation(); onOfficeToggle(id); }}
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
                maxHeight: '200px', overflowY: 'auto'
              }}>
                {offices.map(office => (
                  <label key={office.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                    cursor: 'pointer', fontFamily, fontSize: '14px', color: textColor,
                    backgroundColor: selectedOfficeIds.includes(office.id)
                      ? (isDarkMode ? '#1e293b' : '#f0f9ff') : 'transparent'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedOfficeIds.includes(office.id)}
                      onChange={() => onOfficeToggle(office.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3B82F6' }}
                    />
                    {office.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <p style={{ marginTop: '6px', fontSize: '12px', color: secondaryTextColor, fontFamily }}>
            {selectedOfficeIds.length > 0
              ? `${selectedOfficeIds.length}개 처/실 소속 전원이 이 일정을 볼 수 있습니다.`
              : '같은 부서원은 항상 볼 수 있습니다.'}
          </p>
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

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderColor}`,
            backgroundColor: 'transparent', color: textColor, cursor: 'pointer',
            fontSize: '14px', fontWeight: '500', fontFamily
          }}
        >
          취소
        </button>
        <button
          type="submit" disabled={loading || actionInProgress || rateLimitCountdown > 0}
          style={{
            padding: '12px 24px', borderRadius: '8px', border: 'none',
            backgroundColor: (loading || actionInProgress || rateLimitCountdown > 0) ? '#1e40af' : '#3B82F6',
            color: '#fff', cursor: (loading || actionInProgress || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: '500', fontFamily
          }}
        >
          {(loading || actionInProgress) ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
