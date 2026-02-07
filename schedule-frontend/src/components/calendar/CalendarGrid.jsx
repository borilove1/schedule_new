import React from 'react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getStatusColor } from '../../utils/eventHelpers';
import { getMultiDayEventsForWeek, getSingleDayEventsForDate, assignLanes } from './calendarHelpers';

const CalendarGrid = React.memo(function CalendarGrid({
  weeks, events, currentDate, selectedDay, onDayClick, onDayDoubleClick, onEventClick, userId
}) {
  const { isDarkMode, textColor, secondaryTextColor, borderColor } = useThemeColors();

  const today = new Date();
  const curMonth = currentDate.getMonth();

  return (
    <div>
      {/* Day Headers (Mon start) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: `1px solid ${borderColor}60`,
        marginBottom: '0'
      }}>
        {['월', '화', '수', '목', '금', '토', '일'].map((name, i) => (
          <div key={name} style={{
            textAlign: 'center',
            padding: '8px 0',
            fontSize: '12px',
            fontWeight: '600',
            color: i === 5 ? (isDarkMode ? '#60A5FA' : '#3B82F6') : i === 6 ? (isDarkMode ? '#F87171' : '#ef4444') : '#94a3b8',
            letterSpacing: '0.05em'
          }}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ marginBottom: '32px' }}>
        {weeks.map((week, weekIdx) => {
          const weekMultiDay = getMultiDayEventsForWeek(week, events);
          const lanes = assignLanes(weekMultiDay);
          const maxMultiLanes = 3;
          const visibleLanes = lanes.slice(0, maxMultiLanes);
          const hiddenLanes = lanes.slice(maxMultiLanes);
          const laneHeight = 19;
          const multiAreaHeight = visibleLanes.length * laneHeight;

          return (
            <div key={weekIdx} style={{ position: 'relative', minHeight: '130px' }}>
              {/* Background layer */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                position: 'absolute',
                top: 0, bottom: 0, left: 0, right: 0,
                gap: '0 4px'
              }}>
                {week.map((day, col) => {
                  const dayIsToday = day.toDateString() === today.toDateString();
                  const dayIsSelected = selectedDay && day.toDateString() === selectedDay.toDateString();

                  let bg = 'transparent';
                  let border = 'none';
                  if (dayIsToday && dayIsSelected) {
                    bg = isDarkMode ? '#3B82F630' : '#3B82F635';
                    border = `1px solid ${isDarkMode ? '#3B82F670' : '#3B82F680'}`;
                  } else if (dayIsToday) {
                    bg = isDarkMode ? '#3B82F620' : '#3B82F625';
                    border = `1px solid ${isDarkMode ? '#3B82F650' : '#3B82F660'}`;
                  } else if (dayIsSelected) {
                    bg = isDarkMode ? '#1e3a5f' : '#ffffff';
                    border = `1px solid ${isDarkMode ? borderColor : '#3B82F6'}`;
                  }

                  return (
                    <div
                      key={col}
                      onClick={() => onDayClick(day)}
                      onDoubleClick={() => onDayDoubleClick(day)}
                      style={{
                        backgroundColor: bg,
                        border,
                        borderRadius: '10px',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                    />
                  );
                })}
              </div>

              {/* Content layer */}
              <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
                {/* Day numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {week.map((day, col) => {
                    const dayIsToday = day.toDateString() === today.toDateString();
                    const dayInMonth = day.getMonth() === curMonth;
                    const isSat = col === 5;
                    const isSun = col === 6;

                    let numColor = dayInMonth ? textColor : (isDarkMode ? '#64748b' : '#cbd5e1');
                    if (isSat && dayInMonth) numColor = '#3B82F6';
                    if (isSun && dayInMonth) numColor = '#ef4444';
                    if (!dayInMonth && isSat) numColor = isDarkMode ? '#3B82F680' : '#93bbfd';
                    if (!dayInMonth && isSun) numColor = isDarkMode ? '#ef444480' : '#fca5a5';

                    return (
                      <div key={col} style={{ padding: '8px 0 2px 8px', textAlign: 'left' }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: dayIsToday ? '700' : '400',
                          color: dayIsToday ? '#3B82F6' : numColor
                        }}>
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Multi-day spanning bars */}
                {visibleLanes.length > 0 && (
                  <div style={{ position: 'relative', height: `${multiAreaHeight}px` }}>
                    {visibleLanes.map((lane, laneIdx) =>
                      lane.map(bar => {
                        const isOwn = bar.event.creator?.id === userId;
                        const barColor = isOwn ? getStatusColor(bar.event.status) : '#94a3b8';
                        const colWidth = 100 / 7;
                        const left = (bar.startCol - 1) * colWidth;
                        const width = (bar.endCol - bar.startCol + 1) * colWidth;
                        return (
                          <div
                            key={bar.event.id}
                            style={{
                              position: 'absolute',
                              top: `${laneIdx * laneHeight}px`,
                              left: `calc(${left}% + ${bar.isStartInWeek ? 3 : 0}px)`,
                              width: `calc(${width}% - ${(bar.isStartInWeek ? 3 : 0) + (bar.isEndInWeek ? 3 : 0)}px)`,
                              height: '18px',
                              fontSize: '10px',
                              padding: '2px 6px',
                              backgroundColor: barColor + (isDarkMode ? '45' : '30'),
                              color: isOwn ? barColor : (isDarkMode ? '#cbd5e1' : '#64748b'),
                              borderLeft: bar.isStartInWeek ? `3px solid ${barColor}` : 'none',
                              borderRadius: `${bar.isStartInWeek ? '4px' : '0'} ${bar.isEndInWeek ? '4px' : '0'} ${bar.isEndInWeek ? '4px' : '0'} ${bar.isStartInWeek ? '4px' : '0'}`,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              fontWeight: '600',
                              lineHeight: '14px',
                              boxSizing: 'border-box'
                            }}
                          >
                            {!isOwn && bar.isStartInWeek && <span>{bar.event.creator?.name} </span>}
                            {bar.event.title}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Single-day events per cell */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  paddingBottom: '8px',
                  minHeight: '4px',
                  gap: '0 2px'
                }}>
                  {week.map((day, col) => {
                    const visibleMultiInCell = visibleLanes.reduce((count, lane) =>
                      count + lane.filter(bar => (col + 1) >= bar.startCol && (col + 1) <= bar.endCol).length
                    , 0);
                    const hiddenMultiInCell = hiddenLanes.reduce((count, lane) =>
                      count + lane.filter(bar => (col + 1) >= bar.startCol && (col + 1) <= bar.endCol).length
                    , 0);

                    const singles = getSingleDayEventsForDate(day, events);
                    const remainingSlots = Math.max(0, 4 - visibleMultiInCell);
                    const showSingles = Math.min(singles.length, remainingSlots);
                    const hiddenCount = hiddenMultiInCell + (singles.length - showSingles);

                    if (showSingles === 0 && hiddenCount === 0) return <div key={col} />;

                    return (
                      <div key={col} style={{ padding: '0 3px', overflow: 'hidden' }}>
                        {singles.slice(0, showSingles).map(ev => {
                          const isOwn = ev.creator?.id === userId;
                          const barColor = isOwn ? getStatusColor(ev.status) : '#94a3b8';
                          return (
                            <div
                              key={ev.id}
                              style={{
                                fontSize: '10px',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                backgroundColor: barColor + (isDarkMode ? '35' : '28'),
                                color: isOwn ? barColor : (isDarkMode ? '#cbd5e1' : '#64748b'),
                                borderLeft: `3px solid ${barColor}`,
                                marginBottom: '1px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                fontWeight: '500',
                                lineHeight: '14px',
                                boxSizing: 'border-box',
                                maxWidth: '100%'
                              }}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                        {hiddenCount > 0 && (
                          <div style={{ fontSize: '10px', color: secondaryTextColor, textAlign: 'center' }}>
                            +{hiddenCount}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default CalendarGrid;
