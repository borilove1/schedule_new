import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';

const CalendarHeader = React.memo(function CalendarHeader({
  currentDate, onPrevMonth, onNextMonth, onToday, onNewEvent, onSearch, isMobile
}) {
  const { textColor, secondaryTextColor, cardBg, borderColor } = useThemeColors();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <h1 style={{ fontSize: isMobile ? '40px' : '48px', fontWeight: '700', margin: 0, lineHeight: 1 }}>
          {currentDate.getMonth() + 1}
        </h1>
        <span style={{ fontSize: '16px', color: secondaryTextColor }}>
          {currentDate.getFullYear()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={onPrevMonth}
          style={{ background: 'none', border: 'none', color: secondaryTextColor, cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '6px' }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={onNextMonth}
          style={{ background: 'none', border: 'none', color: secondaryTextColor, cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '6px' }}
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={onSearch}
          style={{ background: 'none', border: 'none', color: secondaryTextColor, cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '6px' }}
          title="일정 검색"
          aria-label="일정 검색"
        >
          <Search size={18} />
        </button>
        <button
          onClick={onToday}
          style={{
            padding: '5px 14px',
            borderRadius: '20px',
            border: `1px solid ${borderColor}`,
            backgroundColor: cardBg,
            color: textColor,
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '4px'
          }}
        >
          <span style={{ fontSize: '11px', letterSpacing: '0.05em' }}>TODAY</span>
        </button>
        {!isMobile && (
          <button
            onClick={onNewEvent}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#3B82F6',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px'
            }}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

export default CalendarHeader;
