import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useCommonStyles } from '../../hooks/useCommonStyles';

function TimePickerInput({ name, value, onChange, required, style, isMobile }) {
  const { isDarkMode, textColor, secondaryTextColor, borderColor, cardBg, hoverBg } = useThemeColors();
  const { fontFamily } = useCommonStyles();
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hourValue, setHourValue] = useState('');
  const [minuteValue, setMinuteValue] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      setHourValue(h || '00');
      setMinuteValue(m || '00');
    }
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const scrollToSelected = (listRef, selectedValue) => {
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

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleSelect = useCallback((type, val) => {
    let newH = hourValue, newM = minuteValue;
    if (type === 'hour') newH = val;
    if (type === 'minute') newM = val;
    setHourValue(newH);
    setMinuteValue(newM);
    onChange({ target: { name, value: `${newH}:${newM}` } });
  }, [hourValue, minuteValue, name, onChange]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')), []);

  const primaryColor = '#3b82f6';
  const active = isFocused || isOpen;

  const columnStyle = {
    flex: 1, overflowY: 'auto', maxHeight: isMobile ? '140px' : '200px',
    scrollbarWidth: 'thin',
    scrollbarColor: isDarkMode ? '#475569 transparent' : '#cbd5e1 transparent',
  };

  const itemStyle = (selected) => ({
    padding: isMobile ? '6px 4px' : '8px 4px', textAlign: 'center', fontSize: isMobile ? '13px' : '14px',
    fontWeight: selected ? '700' : '400', fontFamily,
    cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s',
    backgroundColor: selected ? primaryColor : 'transparent',
    color: selected ? '#ffffff' : textColor,
    border: 'none', width: '100%', display: 'block',
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'text',
          borderColor: active ? '#3B82F6' : borderColor,
          boxShadow: active ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="time"
          name={name}
          value={value}
          required={required}
          onChange={onChange}
          className="custom-time-input"
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget)) setIsFocused(false);
          }}
          style={{
            flex: 1, border: 'none', outline: 'none',
            backgroundColor: 'transparent', color: textColor,
            fontSize: isMobile ? '13px' : '14px', fontFamily,
            padding: 0, margin: 0, width: '100%', minWidth: 0,
            colorScheme: isDarkMode ? 'dark' : 'light',
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{
            background: 'none', border: 'none', padding: '2px',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, borderRadius: '4px',
            color: secondaryTextColor, transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
          onMouseLeave={(e) => e.currentTarget.style.color = secondaryTextColor}
        >
          <Clock size={isMobile ? 14 : 16} />
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          backgroundColor: cardBg, borderRadius: '12px', border: `1px solid ${borderColor}`,
          boxShadow: isDarkMode ? '0 12px 40px rgba(0,0,0,0.4)' : '0 12px 40px rgba(0,0,0,0.12)',
          zIndex: 1100, padding: '12px', minWidth: isMobile ? undefined : '240px', fontFamily,
        }} onClick={(e) => e.stopPropagation()}>
          {/* Hour/Minute columns */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: secondaryTextColor, marginBottom: '6px', fontFamily }}>시</div>
              <div ref={hourListRef} style={columnStyle}>
                {hours.map(h => (
                  <button key={h} type="button" data-value={h} onClick={() => handleSelect('hour', h)} style={itemStyle(h === hourValue)}
                    onMouseEnter={(e) => { if (h !== hourValue) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { if (h !== hourValue) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '1px', backgroundColor: borderColor, alignSelf: 'stretch', margin: '20px 0 0' }} />
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: secondaryTextColor, marginBottom: '6px', fontFamily }}>분</div>
              <div ref={minuteListRef} style={columnStyle}>
                {minutes.map(m => (
                  <button key={m} type="button" data-value={m} onClick={() => handleSelect('minute', m)} style={itemStyle(m === minuteValue)}
                    onMouseEnter={(e) => { if (m !== minuteValue) e.currentTarget.style.backgroundColor = hoverBg; }}
                    onMouseLeave={(e) => { if (m !== minuteValue) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'center' }}>
            <button type="button" onClick={() => setIsOpen(false)}
              style={{ background: primaryColor, border: 'none', color: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '6px 24px', borderRadius: '6px', fontFamily, transition: 'background-color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryColor}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TimePickerInput);
