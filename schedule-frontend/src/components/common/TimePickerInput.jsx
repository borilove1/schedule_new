import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';

// Generate time slots every 30 minutes
const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    TIME_SLOTS.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
  }
}

function TimePickerInput({ name, value, onChange, required, style, isMobile }) {
  const { isDarkMode, textColor, secondaryTextColor, borderColor, cardBg, hoverBg } = useThemeColors();
  const { fontFamily } = useCommonStyles();
  const [isOpen, setIsOpen] = useState(false);
  const [hourValue, setHourValue] = useState('');
  const [minuteValue, setMinuteValue] = useState('');
  const containerRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  // Parse current value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHourValue(h || '00');
      setMinuteValue(m || '00');
    }
  }, [value]);

  // Scroll to selected item when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const scrollToSelected = (listRef, selectedValue, totalItems) => {
          if (!listRef.current) return;
          const items = listRef.current.children;
          for (let i = 0; i < items.length; i++) {
            if (items[i].dataset.value === selectedValue) {
              const itemHeight = items[i].offsetHeight;
              const containerHeight = listRef.current.offsetHeight;
              listRef.current.scrollTop = items[i].offsetTop - containerHeight / 2 + itemHeight / 2;
              break;
            }
          }
        };
        scrollToSelected(hourListRef, hourValue);
        scrollToSelected(minuteListRef, minuteValue);
      }, 50);
    }
  }, [isOpen, hourValue, minuteValue]);

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

  const handleSelect = useCallback((type, val) => {
    let newH = hourValue;
    let newM = minuteValue;
    if (type === 'hour') newH = val;
    if (type === 'minute') newM = val;

    setHourValue(newH);
    setMinuteValue(newM);

    const newValue = `${newH}:${newM}`;
    onChange({ target: { name, value: newValue } });
  }, [hourValue, minuteValue, name, onChange]);

  const handleQuickSelect = useCallback((timeVal) => {
    onChange({ target: { name, value: timeVal } });
    setIsOpen(false);
  }, [name, onChange]);

  // Format display value
  const displayValue = useMemo(() => {
    if (!value) return '';
    const [h, m] = value.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${ampm} ${h12}:${m}`;
  }, [value]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')), []);

  const primaryColor = '#3b82f6';

  const columnStyle = {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '200px',
    scrollbarWidth: 'thin',
    scrollbarColor: isDarkMode ? '#475569 transparent' : '#cbd5e1 transparent',
  };

  const itemStyle = (isSelected) => ({
    padding: '8px 4px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: isSelected ? '700' : '400',
    fontFamily,
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.15s',
    backgroundColor: isSelected ? primaryColor : 'transparent',
    color: isSelected ? '#ffffff' : textColor,
    border: 'none',
    width: '100%',
    display: 'block',
  });

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
    minWidth: isMobile ? undefined : '240px',
    fontFamily,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* Hidden native input for form validation */}
      <input
        type="time"
        name={name}
        value={value}
        required={required}
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
        <Clock size={isMobile ? 14 : 16} color={secondaryTextColor} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1,
          color: value ? textColor : secondaryTextColor,
          fontSize: isMobile ? '13px' : '14px',
          fontFamily,
        }}>
          {displayValue || '시간 선택'}
        </span>
      </div>

      {/* Time picker popup */}
      {isOpen && (
        <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
          {/* Quick select - common times */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: `1px solid ${borderColor}`,
          }}>
            {['09:00', '10:00', '12:00', '14:00', '15:00', '17:00', '18:00'].map(t => {
              const [h] = t.split(':');
              const hour = parseInt(h, 10);
              const ampm = hour < 12 ? '오전' : '오후';
              const h12 = hour > 12 ? hour - 12 : hour;
              const isActive = value === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleQuickSelect(t)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: `1px solid ${isActive ? primaryColor : borderColor}`,
                    backgroundColor: isActive ? primaryColor : 'transparent',
                    color: isActive ? '#ffffff' : secondaryTextColor,
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontFamily,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = primaryColor;
                      e.currentTarget.style.color = primaryColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = borderColor;
                      e.currentTarget.style.color = secondaryTextColor;
                    }
                  }}
                >
                  {ampm} {h12}시
                </button>
              );
            })}
          </div>

          {/* Hour/Minute columns */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Hour column */}
            <div style={{ flex: 1 }}>
              <div style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: '600',
                color: secondaryTextColor,
                marginBottom: '6px',
                fontFamily,
              }}>시</div>
              <div ref={hourListRef} style={columnStyle}>
                {hours.map(h => (
                  <button
                    key={h}
                    type="button"
                    data-value={h}
                    onClick={() => handleSelect('hour', h)}
                    style={itemStyle(h === hourValue)}
                    onMouseEnter={(e) => {
                      if (h !== hourValue) e.currentTarget.style.backgroundColor = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (h !== hourValue) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              width: '1px',
              backgroundColor: borderColor,
              alignSelf: 'stretch',
              margin: '20px 0 0',
            }} />

            {/* Minute column */}
            <div style={{ flex: 1 }}>
              <div style={{
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: '600',
                color: secondaryTextColor,
                marginBottom: '6px',
                fontFamily,
              }}>분</div>
              <div ref={minuteListRef} style={columnStyle}>
                {minutes.map(m => (
                  <button
                    key={m}
                    type="button"
                    data-value={m}
                    onClick={() => handleSelect('minute', m)}
                    style={itemStyle(m === minuteValue)}
                    onMouseEnter={(e) => {
                      if (m !== minuteValue) e.currentTarget.style.backgroundColor = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (m !== minuteValue) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <div style={{
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: `1px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: primaryColor,
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '6px 24px',
                borderRadius: '6px',
                fontFamily,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryColor}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TimePickerInput);
