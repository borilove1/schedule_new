import { useState, useRef, useCallback } from 'react';

/**
 * 모바일에서 아래로 스와이프하여 모달/오버레이를 닫는 훅
 * @param {Function} onClose - 닫기 콜백 (애니메이션 완료 후 호출)
 * @param {Object} options
 * @param {number} options.threshold - 닫기 트리거 거리 (px, 기본 100)
 */
export function useSwipeDown(onClose, { threshold = 100 } = {}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const trackingRef = useRef(false);
  const startYRef = useRef(0);
  const rawOffsetRef = useRef(0);
  const contentRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (dismissing) return;
    const content = contentRef.current;
    // 스크롤 가능한 콘텐츠 영역이 스크롤된 상태면 스와이프 무시
    if (content && content.contains(e.target) && content.scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
    trackingRef.current = true;
  }, [dismissing]);

  const handleTouchMove = useCallback((e) => {
    if (!trackingRef.current) return;
    const rawDelta = e.touches[0].clientY - startYRef.current;
    if (rawDelta > 0) {
      rawOffsetRef.current = rawDelta;
      setSwipeOffset(rawDelta);
    } else {
      // 위로 스와이프 시 트래킹 중단
      if (rawOffsetRef.current === 0) {
        trackingRef.current = false;
      }
      rawOffsetRef.current = 0;
      setSwipeOffset(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!trackingRef.current) return;
    trackingRef.current = false;
    if (rawOffsetRef.current > threshold) {
      // 임계값 초과 → 닫기 애니메이션 시작
      setDismissing(true);
      setSwipeOffset(0);
      rawOffsetRef.current = 0;
      setTimeout(() => {
        setDismissing(false);
        onClose();
      }, 300);
    } else {
      // 임계값 미만 → 원래 위치로 복귀
      rawOffsetRef.current = 0;
      setSwipeOffset(0);
    }
  }, [threshold, onClose]);

  // 모달 내부 컨테이너의 transform/transition 오버라이드
  const swipeStyle = dismissing
    ? { transform: 'translateY(100%)', transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }
    : swipeOffset > 0
      ? { transform: `translateY(${swipeOffset}px)`, transition: 'none' }
      : null;

  // 배경 오버레이 투명도 (1 = 정상, 0 = 투명)
  const backdropOpacity = dismissing ? 0 : swipeOffset > 0 ? Math.max(0, 1 - swipeOffset / 400) : 1;

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    swipeStyle,
    backdropOpacity,
    contentRef,
  };
}
