import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import EventModal from '../events/EventModal';
import EventDetailModal from '../events/EventDetailModal';
import EventSearchModal from '../events/EventSearchModal';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';
import EventList from './EventList';
import { getCalendarDays, getWeeks, getEventsForDate, filterEventsByTab } from './calendarHelpers';
import Skeleton from '../common/Skeleton';
import api from '../../utils/api';
import { connectSSE, onSSE } from '../../utils/sseClient';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif';

export default function Calendar({ rateLimitCountdown = 0, onRateLimitStart, cachedEvents = [], onEventsLoaded, pendingEventId, onEventOpened, onNavigateSettings, onEventNavigate }) {
  const { user } = useAuth();
  const { textColor, borderColor, cardBg } = useThemeColors();
  const isMobile = useIsMobile();
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const showFAB = isTouchDevice;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState(cachedEvents);
  const [eventsLoading, setEventsLoading] = useState(cachedEvents.length === 0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTab, setSelectedTab] = useState('all');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const startCountdown = useCallback((seconds) => {
    if (onRateLimitStart) onRateLimitStart(seconds);
  }, [onRateLimitStart]);

  const loadEventsRef = useRef(false);
  const loadEvents = useCallback(async (silent = false) => {
    if (loadEventsRef.current) return; // 중복 호출 방지
    loadEventsRef.current = true;
    if (!silent) setEventsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const firstDow = firstDay.getDay();
      const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
      const startDate = new Date(year, month, 1 - mondayOffset);

      const lastDow = lastDay.getDay();
      const sundayOffset = lastDow === 0 ? 0 : 7 - lastDow;
      const endDate = new Date(year, month + 1, sundayOffset);

      const data = await api.getEvents({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      const loaded = data.data?.events || data.events || [];
      setEvents(loaded);
      if (onEventsLoaded) onEventsLoaded(loaded);
    } catch (err) {
      console.error('Failed to load events:', err);
      const msg = err.message || '';
      if (msg.includes('너무 많은 요청') || msg.includes('RATE_LIMIT')) {
        startCountdown(60);
        setTimeout(() => loadEvents(), 60000);
      }
    } finally {
      if (!silent) setEventsLoading(false);
      loadEventsRef.current = false;
    }
  }, [currentDate, startCountdown]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // SSE 실시간 갱신: 다른 사용자의 일정 변경 시 즉시 반영 (스켈레톤 없이)
  useEffect(() => {
    connectSSE();
    const unsubscribe = onSSE('event_changed', () => {
      loadEvents(true);
    });
    return () => {
      unsubscribe();
    };
  }, [loadEvents]);

  // Visibility API: 앱 복귀 시 즉시 갱신 (스켈레톤 없이)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadEvents(true);
        connectSSE();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadEvents]);

  // 마감임박 자동 갱신: 일정이 마감임박 상태로 전환되는 시점에 자동 새로고침
  useEffect(() => {
    if (events.length === 0) return;

    const now = new Date();
    const dueSoonThresholdMs = 30 * 60 * 1000; // 30분 (시스템 설정 기본값)

    // PENDING 상태이고 아직 마감임박이 아닌 일정들 중 가장 빨리 마감임박 상태가 되는 시점 계산
    let nextDueSoonTime = null;
    for (const event of events) {
      if (event.status === 'DONE' || event.isDueSoon || event.status === 'OVERDUE') continue;
      const endTime = new Date(event.endAt);
      const dueSoonBoundary = new Date(endTime.getTime() - dueSoonThresholdMs);
      if (dueSoonBoundary > now) {
        if (!nextDueSoonTime || dueSoonBoundary < nextDueSoonTime) {
          nextDueSoonTime = dueSoonBoundary;
        }
      }
    }

    if (!nextDueSoonTime) return;

    const msUntilDueSoon = nextDueSoonTime.getTime() - now.getTime();
    // 1초 버퍼 추가하여 정확한 시점 이후에 갱신
    const timerId = setTimeout(() => {
      loadEvents(true);
    }, msUntilDueSoon + 1000);

    return () => clearTimeout(timerId);
  }, [events, loadEvents]);

  // 알림에서 일정 클릭 시 해당 일정 상세 모달 열기
  useEffect(() => {
    if (pendingEventId) {
      setSelectedEventId(pendingEventId);
      setShowDetailModal(true);
      if (onEventOpened) onEventOpened();
    }
  }, [pendingEventId, onEventOpened]);

  // --- Computed ---
  const days = useMemo(() => getCalendarDays(currentDate), [currentDate]);
  const weeks = useMemo(() => getWeeks(days), [days]);
  const listEvents = useMemo(
    () => selectedDay ? getEventsForDate(selectedDay, events) : events,
    [selectedDay, events]
  );
  const filteredListEvents = useMemo(
    () => filterEventsByTab(listEvents, selectedTab),
    [listEvents, selectedTab]
  );

  // --- Handlers ---
  const handleEventSuccess = useCallback(() => loadEvents(), [loadEvents]);

  const handleNewEvent = useCallback((date = null) => {
    const t = date || new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
    setShowModal(true);
  }, []);

  const handleEventClick = useCallback((eventId) => {
    setSelectedEventId(eventId);
    setShowDetailModal(true);
  }, []);

  const handleSearchEventClick = useCallback((eventId, startAt) => {
    if (startAt) {
      const d = new Date(startAt);
      setCurrentDate(new Date(d.getFullYear(), d.getMonth()));
      setSelectedDay(d);
    }
    setSelectedEventId(eventId);
    setShowDetailModal(true);
  }, []);

  const handleDayClick = useCallback((day) => {
    const scrollY = window.scrollY;
    setSelectedDay(day);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }, []);

  // 슬라이드 애니메이션 상태 (PC/모바일 공용)
  const touchRef = useRef(null);
  const swipeContainerRef = useRef(null);
  const [slideStyle, setSlideStyle] = useState({});

  // 슬라이드 애니메이션과 함께 월 변경 (PC 버튼 / 모바일 스와이프 공용)
  const animateMonthChange = useCallback((direction) => {
    const goLeft = direction === 'next';
    const exitX = goLeft ? '-30%' : '30%';
    const enterX = goLeft ? '30%' : '-30%';
    setSlideStyle({ transform: `translateX(${exitX})`, opacity: 0, transition: 'transform 0.2s ease, opacity 0.2s ease' });
    setTimeout(() => {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + (goLeft ? 1 : -1)));
      setSelectedDay(null);
      setSlideStyle({ transform: `translateX(${enterX})`, opacity: 0, transition: 'none' });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideStyle({ transform: 'translateX(0)', opacity: 1, transition: 'transform 0.2s ease, opacity 0.2s ease' });
        });
      });
    }, 200);
  }, []);

  const handlePrevMonth = useCallback(() => {
    animateMonthChange('prev');
  }, [animateMonthChange]);

  const handleNextMonth = useCallback(() => {
    animateMonthChange('next');
  }, [animateMonthChange]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  }, []);

  const handleSearchOpen = useCallback(() => setShowSearchModal(true), []);
  const handleSearchClose = useCallback(() => setShowSearchModal(false), []);

  // 터치 디바이스에서 스와이프로 월 이동
  const handleTouchStart = useCallback((e) => {
    if (!isTouchDevice) return;
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [isTouchDevice]);
  const handleTouchEnd = useCallback((e) => {
    if (!isTouchDevice || !touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    animateMonthChange(dx < 0 ? 'next' : 'prev');
  }, [isTouchDevice, animateMonthChange]);

  // 스와이프 중 세로 스크롤 방지 (가로 이동이 세로보다 클 때)
  useEffect(() => {
    if (!isTouchDevice) return;
    const el = swipeContainerRef.current;
    if (!el) return;
    const handleTouchMove = (e) => {
      if (!touchRef.current) return;
      const dx = Math.abs(e.touches[0].clientX - touchRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchRef.current.y);
      if (dx > dy && dx > 10) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [isTouchDevice]);

  return (
    <div style={{ color: textColor, fontFamily: FONT_FAMILY }}>
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onNewEvent={() => handleNewEvent(selectedDay)}
        onSearch={handleSearchOpen}
        onSettings={onNavigateSettings}
        onEventNavigate={onEventNavigate}
        isMobile={isMobile}
        isTouchDevice={isTouchDevice}
      />

      <div ref={swipeContainerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ overflow: 'hidden' }}>
        <div style={slideStyle}>
          <CalendarGrid
            weeks={weeks}
            events={events}
            currentDate={currentDate}
            selectedDay={selectedDay}
            onDayClick={handleDayClick}
            onDayDoubleClick={handleNewEvent}
            onEventClick={handleEventClick}
            userId={user?.id}
          />

          {eventsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  padding: '16px', borderRadius: '10px',
                  backgroundColor: cardBg, border: `1px solid ${borderColor}`,
                  borderLeft: '4px solid transparent',
                }}>
                  <Skeleton width="60%" height="18px" style={{ marginBottom: '8px' }} />
                  <Skeleton width="40%" height="14px" />
                </div>
              ))}
            </div>
          ) : (
            <EventList
              events={filteredListEvents}
              allEventsCount={events.length}
              selectedDay={selectedDay}
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
              onClearSelection={() => setSelectedDay(null)}
              onEventClick={handleEventClick}
              userId={user?.id}
            />
          )}
        </div>
      </div>

      <EventModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleEventSuccess}
        selectedDate={selectedDate}
        rateLimitCountdown={rateLimitCountdown}
        onRateLimitStart={startCountdown}
      />
      <EventDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        eventId={selectedEventId}
        onSuccess={handleEventSuccess}
        rateLimitCountdown={rateLimitCountdown}
        onRateLimitStart={startCountdown}
      />
      <EventSearchModal
        isOpen={showSearchModal}
        onClose={handleSearchClose}
        onEventClick={handleSearchEventClick}
      />

      {/* 모바일/태블릿/터치 디바이스 FAB - 모달 열려있을 때 숨김 */}
      {showFAB && !showModal && !showDetailModal && !showSearchModal && (
        <button
          onClick={() => handleNewEvent(selectedDay)}
          aria-label="새 일정 만들기"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#3B82F6',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            zIndex: 900,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
}
