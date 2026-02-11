import React, { useState, useEffect } from 'react';
import { ChevronDown, MessageCircle, Paperclip } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getStatusColor, getStatusText, getDisplayStatus, norm } from '../../utils/eventHelpers';

const EventList = React.memo(function EventList({
  events, allEventsCount, selectedDay, selectedTab, onTabChange, onClearSelection, onEventClick, userId
}) {
  const { isDarkMode, textColor, secondaryTextColor, cardBg, borderColor } = useThemeColors();
  const isMobile = useIsMobile();
  const [displayCount, setDisplayCount] = useState(10);
  const [hoveredId, setHoveredId] = useState(null);

  // 탭/필터/날짜 변경 시 displayCount 리셋
  useEffect(() => {
    setDisplayCount(10);
  }, [selectedTab, selectedDay]);

  return (
    <div id="event-list" style={{ overflowAnchor: 'none' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '600', margin: 0 }}>
          {selectedDay
            ? `${selectedDay.getMonth() + 1}월 ${selectedDay.getDate()}일 일정`
            : `이번 달 일정 (${allEventsCount}개)`
          }
        </h3>
        {selectedDay && (
          <button
            onClick={onClearSelection}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: `1px solid ${borderColor}`,
              backgroundColor: 'transparent',
              color: textColor,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            전체 보기
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '16px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { key: 'all', label: '전체' },
          { key: 'ongoing', label: '진행중' },
          { key: 'due_soon', label: '마감임박' },
          { key: 'completed', label: '완료' },
          { key: 'overdue', label: '지연' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: '7px 16px',
              borderRadius: '20px',
              border: selectedTab === tab.key ? 'none' : `1px solid ${borderColor}`,
              backgroundColor: selectedTab === tab.key ? '#3B82F6' : (isDarkMode ? 'transparent' : '#ffffff'),
              color: selectedTab === tab.key ? '#fff' : secondaryTextColor,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event Cards */}
      {events.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
          color: secondaryTextColor,
          fontSize: '14px'
        }}>
          {selectedDay ? '해당 날짜에 일정이 없습니다.' : '일정이 없습니다. 새 일정을 추가해보세요!'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.slice(0, displayCount).map(event => {
            const startDate = new Date(event.startAt);
            const endDate = new Date(event.endAt);
            const isMultiDayEvent = norm(startDate).getTime() !== norm(endDate).getTime();
            const isOwnEvent = event.creator?.id === userId;

            return (
              <div
                key={event.id}
                onClick={() => onEventClick(event.id)}
                onMouseEnter={() => setHoveredId(event.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: isMobile ? '14px' : '16px',
                  borderRadius: '10px',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderLeft: `4px solid ${isOwnEvent ? getStatusColor(getDisplayStatus(event)) : '#94a3b8'}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  transform: hoveredId === event.id ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: hoveredId === event.id
                    ? (isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)')
                    : 'none',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: '600', color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.title}
                    </div>
                    {!isOwnEvent && event.creator?.name && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
                        color: secondaryTextColor,
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        {event.department ? `${event.department} ${event.creator.name}` : event.creator.name}
                      </span>
                    )}
                    {event.sharedOffices && event.sharedOffices.length > 0 && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#3b2f63' : '#ede9fe',
                        color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        공유
                      </span>
                    )}
                    {event.commentCount > 0 && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe',
                        color: isDarkMode ? '#93c5fd' : '#2563eb',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}>
                        <MessageCircle size={11} />
                        {event.commentCount}
                      </span>
                    )}
                    {event.attachmentCount > 0 && (
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: isDarkMode ? '#3b1f6e' : '#f3e8ff',
                        color: isDarkMode ? '#c4b5fd' : '#7c3aed',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}>
                        <Paperclip size={11} />
                        {event.attachmentCount}
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: getStatusColor(getDisplayStatus(event)) + '30',
                    color: getStatusColor(getDisplayStatus(event)),
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    {getStatusText(getDisplayStatus(event))}
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: secondaryTextColor }}>
                  {isMultiDayEvent ? (
                    <>
                      {startDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      {' ~ '}
                      {endDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </>
                  ) : (
                    <>
                      {startDate.toLocaleString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {' ~ '}
                      {endDate.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </>
                  )}
                </div>
                {event.content && (
                  <div style={{
                    fontSize: '14px',
                    color: isDarkMode ? secondaryTextColor : '#94a3b8',
                    marginTop: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {event.content}
                  </div>
                )}
              </div>
            );
          })}
          {events.length > displayCount && (
            <button
              onClick={() => setDisplayCount(prev => prev + 10)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent',
                color: secondaryTextColor,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '4px',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ChevronDown size={16} />
              더보기 ({events.length - displayCount}개 남음)
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default EventList;
