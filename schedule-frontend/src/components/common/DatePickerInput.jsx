import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function DatePickerInput({ name, value, onChange, required, min, style, isMobile }) {
  const { isDarkMode, textColor, secondaryTextColor, borderColor, cardBg, hoverBg } = useThemeColors();
  const { fontFamily } = useCommonStyles();
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(null);
  const [viewMonth, setViewMonth] = useState(null);
  const containerRef = useRef(null);

  // Parse current value
  const parsed = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  }, [value]);

  // Parse min date
  const minParsed = useMemo(() => {
    if (!min) return null;
    const [y, m, d] = min.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [min]);

  // Initialize view to selected date or today
  useEffect(() => {
    if (isOpen) {
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      } else {
        const today = new Date();
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
    }
  }, [isOpen, parsed]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handlePrevMonth = useCallback((e) => {
    e.stopPropagation();
    setViewMonth(m => {
      if (m === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const handleNextMonth = useCallback((e) => {
    e.stopPropagation();
    setViewMonth(m => {
      if (m === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleSelectDay = useCallback((day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const newValue = `${viewYear}-${mm}-${dd}`;
    onChange({ target: { name, value: newValue } });
    setIsOpen(false);
  }, [viewYear, viewMonth, name, onChange]);

  const isToday = useCallback((day) => {
    const t = new Date();
    return viewYear === t.getFullYear() && viewMonth === t.getMonth() && day === t.getDate();
  }, [viewYear, viewMonth]);

  const isSelected = useCallback((day) => {
    return parsed && viewYear === parsed.year && viewMonth === parsed.month && day === parsed.day;
  }, [parsed, viewYear, viewMonth]);

  const isDisabled = useCallback((day) => {
    if (!minParsed) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d < minParsed;
  }, [minParsed, viewYear, viewMonth]);

  // Format display value
  const displayValue = useMemo(() => {
    if (!value || !parsed) return '';
    return `${parsed.year}. ${parsed.month + 1}. ${parsed.day}.`;
  }, [value, parsed]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    if (viewYear == null || viewMonth == null) return [];
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);

    const days = [];
    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, type: 'prev' });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, type: 'current' });
    }
    // Next month leading days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, type: 'next' });
    }
    return days;
  }, [viewYear, viewMonth]);

  const primaryColor = '#3b82f6';

  const popupStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: cardBg,
    borderRadius: '12px',
    border: `1px solid ${borderColor}`,
    boxShadow: isDarkMode ? '0 12px 40px rgba(0,0,0,0.4)' : '0 12px 40px rgba(0,0,0,0.12)',
    zIndex: 1100,
    padding: '12px',
    minWidth: isMobile ? undefined : '280px',
    fontFamily,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Hidden native input for form validation */}
      <input
        type="date"
        name={name}
        value={value}
        required={required}
        min={min}
        onChange={onChange}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Custom display input */}
      <div
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          width: '100%',
        }}
      >
        <Calendar size={isMobile ? 14 : 16} color={secondaryTextColor} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1,
          color: value ? textColor : secondaryTextColor,
          fontSize: isMobile ? '13px' : '14px',
          fontFamily,
        }}>
          {displayValue || '날짜 선택'}
        </span>
      </div>

      {/* Calendar popup */}
      {isOpen && viewYear != null && (
        <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
          {/* Header - Month/Year navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            padding: '0 2px',
          }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: secondaryTextColor,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{
              fontSize: '15px',
              fontWeight: '600',
              color: textColor,
              fontFamily,
            }}>
              {viewYear}년 {MONTHS[viewMonth]}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: secondaryTextColor,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0',
            marginBottom: '4px',
          }}>
            {WEEKDAYS.map((wd, i) => (
              <div key={wd} style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: '600',
                color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : secondaryTextColor,
                padding: '4px 0',
                fontFamily,
              }}>
                {wd}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
          }}>
            {calendarDays.map((item, idx) => {
              const isCurrent = item.type === 'current';
              const sel = isCurrent && isSelected(item.day);
              const tod = isCurrent && isToday(item.day);
              const dis = isCurrent && isDisabled(item.day);
              const dayOfWeek = idx % 7;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isCurrent || dis}
                  onClick={() => isCurrent && !dis && handleSelectDay(item.day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: sel ? '700' : tod ? '600' : '400',
                    fontFamily,
                    cursor: isCurrent && !dis ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    backgroundColor: sel ? primaryColor : 'transparent',
                    color: sel
                      ? '#ffffff'
                      : !isCurrent || dis
                        ? isDarkMode ? '#475569' : '#cbd5e1'
                        : dayOfWeek === 0
                          ? '#ef4444'
                          : dayOfWeek === 6
                            ? '#3b82f6'
                            : textColor,
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (isCurrent && !dis && !sel) {
                      e.currentTarget.style.backgroundColor = hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!sel) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {item.day}
                  {/* Today dot indicator */}
                  {tod && !sel && (
                    <span style={{
                      position: 'absolute',
                      bottom: '3px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: primaryColor,
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                const mm = String(t.getMonth() + 1).padStart(2, '0');
                const dd = String(t.getDate()).padStart(2, '0');
                onChange({ target: { name, value: `${t.getFullYear()}-${mm}-${dd}` } });
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: primaryColor,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '6px 16px',
                borderRadius: '6px',
                fontFamily,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(DatePickerInput);
