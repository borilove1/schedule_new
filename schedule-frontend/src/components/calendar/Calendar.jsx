import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import EventModal from '../events/EventModal';
import EventDetailModal from '../events/EventDetailModal';
import api from '../../utils/api';

export default function Calendar() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [loading, setLoading] = useState(false);

  const darkMode = true;
  const bgColor = '#0f172a';
  const textColor = '#e2e8f0';
  const secondaryTextColor = '#94a3b8';
  const cardBg = '#1e293b';
  const borderColor = '#334155';

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());

      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const data = await api.getEvents({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      setEvents(data.data?.events || data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSuccess = () => {
    loadEvents();
  };

  const handleNewEvent = (date = null) => {
    const targetDate = date || new Date();
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
    setShowModal(true);
  };

  const handleEventClick = (eventId) => {
    setSelectedEventId(eventId);
    setShowDetailModal(true);
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setTimeout(() => {
      document.getElementById('event-list')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 100);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.startAt);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'DONE': return '#10B981';
      case 'OVERDUE': return '#ef4444';
      default: return '#3B82F6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'DONE': return '완료';
      case 'OVERDUE': return '지연';
      default: return '진행중';
    }
  };

  const filterEventsByTab = (eventsList) => {
    switch (selectedTab) {
      case 'ongoing':
        return eventsList.filter(e => e.status === 'PENDING' || e.status === 'IN_PROGRESS');
      case 'completed':
        return eventsList.filter(e => e.status === 'DONE');
      case 'overdue':
        return eventsList.filter(e => e.status === 'OVERDUE');
      default:
        return eventsList;
    }
  };

  const days = getDaysInMonth();
  const isMobile = window.innerWidth < 768;

  return (
    <div style={{
      color: textColor,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <div style={{ 
            fontSize: isMobile ? '14px' : '16px',
            color: secondaryTextColor,
            marginBottom: '8px'
          }}>
            {user?.division} {user?.office}
          </div>
          <div style={{ 
            fontSize: isMobile ? '16px' : '18px',
            color: textColor,
            fontWeight: '500'
          }}>
            {user?.department} {user?.name}님
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={24} />
          </button>
          <h2 style={{
            fontSize: isMobile ? '28px' : '32px',
            fontWeight: '300',
            margin: 0
          }}>
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setCurrentDate(new Date())}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: `1px solid ${borderColor}`,
              backgroundColor: cardBg,
              color: textColor,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            오늘
          </button>
          <button
            onClick={() => handleNewEvent(selectedDay)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3B82F6',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={18} />
            새 일정
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          marginBottom: '16px'
        }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div key={day} style={{
              textAlign: 'center',
              padding: '12px',
              fontSize: '14px',
              color: index === 0 ? '#ef4444' : index === 6 ? '#3B82F6' : secondaryTextColor,
              fontWeight: '600'
            }}>
              {day}
            </div>
          ))}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px'
        }}>
          {days.map((day, index) => {
            const dayEvents = day ? getEventsForDate(day) : [];
            const isSelected = day && selectedDay && day.toDateString() === selectedDay.toDateString();
            const isToday = day && day.toDateString() === new Date().toDateString();
            const isWeekend = index % 7 === 0 || index % 7 === 6;

            return (
              <div
                key={index}
                onClick={() => day && handleDayClick(day)}
                style={{
                  minHeight: isMobile ? '60px' : '100px',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: isSelected ? cardBg : 'transparent',
                  border: `1px solid ${isSelected ? '#3B82F6' : isToday ? '#3B82F6' : borderColor}`,
                  cursor: day ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'all 0.2s',
                  opacity: day ? 1 : 0.3
                }}
                onMouseEnter={(e) => {
                  if (day) {
                    e.currentTarget.style.backgroundColor = cardBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (day && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {day && (
                  <>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: isToday ? '700' : '500',
                      color: isToday ? '#3B82F6' : isWeekend ? (index % 7 === 0 ? '#ef4444' : '#3B82F6') : textColor,
                      marginBottom: '8px'
                    }}>
                      {day.getDate()}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div key={idx} style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: getStatusColor(event.status) + '20',
                          color: getStatusColor(event.status),
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: '500'
                        }}>
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{
                          fontSize: '11px',
                          color: secondaryTextColor,
                          marginTop: '2px',
                          fontWeight: '500'
                        }}>
                          +{dayEvents.length - 3}개
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div id="event-list">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '600', margin: 0 }}>
            {selectedDay 
              ? `${selectedDay.getMonth() + 1}월 ${selectedDay.getDate()}일 일정`
              : `이번 달 일정 (${events.length}개)`
            }
          </h3>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent',
                color: textColor,
                cursor: 'pointer',
                fontSize: '14px',
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
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px'
        }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'ongoing', label: '진행중' },
            { key: 'completed', label: '완료' },
            { key: 'overdue', label: '지연' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedTab === tab.key ? '#3B82F6' : cardBg,
                color: selectedTab === tab.key ? '#fff' : textColor,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Event Cards */}
        {(selectedDay 
          ? filterEventsByTab(events.filter(e => {
              const eventDate = new Date(e.startAt);
              return eventDate.getFullYear() === selectedDay.getFullYear() &&
                     eventDate.getMonth() === selectedDay.getMonth() &&
                     eventDate.getDate() === selectedDay.getDate();
            }))
          : filterEventsByTab(events)
        ).length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: secondaryTextColor,
            fontSize: '16px'
          }}>
            {selectedDay ? '해당 날짜에 일정이 없습니다.' : '일정이 없습니다. 새 일정을 추가해보세요!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(selectedDay 
              ? filterEventsByTab(events.filter(e => {
                  const eventDate = new Date(e.startAt);
                  return eventDate.getFullYear() === selectedDay.getFullYear() &&
                         eventDate.getMonth() === selectedDay.getMonth() &&
                         eventDate.getDate() === selectedDay.getDate();
                }))
              : filterEventsByTab(events)
            ).slice(0, 20).map(event => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event.id)}
                style={{
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '12px',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderLeft: `4px solid ${getStatusColor(event.status)}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: textColor
                  }}>
                    {event.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: getStatusColor(event.status) + '20',
                    color: getStatusColor(event.status),
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    {getStatusText(event.status)}
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: secondaryTextColor,
                  marginBottom: '8px'
                }}>
                  {new Date(event.startAt).toLocaleString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                {event.content && (
                  <div style={{
                    fontSize: '14px',
                    color: secondaryTextColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {event.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <EventModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleEventSuccess}
        selectedDate={selectedDate}
      />
      <EventDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        eventId={selectedEventId}
        onSuccess={handleEventSuccess}
      />
    </div>
  );
}
