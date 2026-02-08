import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Repeat, Calendar } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getStatusColor, getStatusText } from '../../utils/eventHelpers';
import LoadingSpinner from '../common/LoadingSpinner';
import api from '../../utils/api';

export default function EventSearchModal({ isOpen, onClose, onEventClick }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor, hoverBg, inputBg } = useThemeColors();
  const isMobile = useIsMobile();

  // 애니메이션
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // 열릴 때 포커스 + 초기화
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setResults([]);
      setPage(1);
      setTotal(0);
      setTotalPages(0);
      setError('');
      setHoveredIdx(-1);
    }
  }, [isOpen]);

  // ESC 키
  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  // 검색 실행
  const doSearch = useCallback(async (q, p = 1) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.searchEvents({ q: q.trim(), page: p, limit: 20 });
      setResults(data.events || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 0);
      setPage(p);
    } catch (err) {
      setError(err.message || '검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 디바운스 검색
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(searchQuery, 1), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, doSearch]);

  const handlePageChange = (newPage) => {
    doSearch(searchQuery, newPage);
  };

  const handleResultClick = (event) => {
    onEventClick(event.id);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return ''; }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isAnimating ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? '60px 16px 20px' : '80px 20px 20px',
        transition: 'background-color 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: cardBg,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: isMobile ? '80vh' : '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isAnimating ? 'translateY(0)' : 'translateY(-20px)',
          opacity: isAnimating ? 1 : 0,
          transition: 'transform 0.25s ease, opacity 0.2s ease',
          boxShadow: isDarkMode
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: isMobile ? '20px 16px 16px' : '24px 24px 20px',
          borderBottom: `1px solid ${borderColor}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 id="search-modal-title" style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: textColor }}>
              일정 검색
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: secondaryTextColor,
                cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
              }}
              title="닫기"
            >
              <X size={24} />
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                color: secondaryTextColor, pointerEvents: 'none',
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="일정 제목 또는 내용으로 검색..."
              style={{
                width: '100%',
                padding: '10px 36px 10px 40px',
                border: `1px solid ${borderColor}`,
                borderRadius: '8px',
                backgroundColor: inputBg,
                color: textColor,
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3B82F6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = borderColor;
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: secondaryTextColor,
                  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{
              padding: '12px 24px', color: isDarkMode ? '#fca5a5' : '#dc2626',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ padding: '32px 24px' }}>
              <LoadingSpinner message="검색 중..." />
            </div>
          )}

          {!loading && searchQuery.length >= 2 && results.length === 0 && !error && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: secondaryTextColor }}>
              <Search size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '16px' }}>검색 결과가 없습니다.</p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', opacity: 0.7 }}>다른 검색어를 입력해 보세요.</p>
            </div>
          )}

          {!loading && searchQuery.length > 0 && searchQuery.length < 2 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: secondaryTextColor }}>
              <p style={{ margin: 0, fontSize: '14px' }}>2글자 이상 입력하세요.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <div style={{
                padding: '8px 24px', fontSize: '12px', color: secondaryTextColor,
                borderBottom: `1px solid ${borderColor}`,
              }}>
                검색 결과 {total}건
              </div>
              {results.map((event, index) => {
                const statusColor = getStatusColor(event.status);
                const statusText = getStatusText(event.status);
                return (
                  <div
                    key={event.id}
                    onClick={() => handleResultClick(event)}
                    onMouseEnter={() => setHoveredIdx(index)}
                    onMouseLeave={() => setHoveredIdx(-1)}
                    style={{
                      padding: isMobile ? '12px 16px' : '14px 24px',
                      borderBottom: index < results.length - 1 ? `1px solid ${borderColor}` : 'none',
                      cursor: 'pointer',
                      backgroundColor: hoveredIdx === index ? hoverBg : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {/* Title + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                      <span style={{
                        fontWeight: '600', fontSize: '14px', color: textColor,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {event.title}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: '600', color: statusColor,
                        backgroundColor: statusColor + '18',
                        padding: '2px 8px', borderRadius: '10px', flexShrink: 0,
                      }}>
                        {statusText}
                      </span>
                    </div>

                    {/* Date + Recurring */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: secondaryTextColor, marginBottom: '4px' }}>
                      <Calendar size={12} style={{ flexShrink: 0 }} />
                      <span>{formatDate(event.startAt)}</span>
                      {event.startAt && event.endAt && (
                        <span>{formatTime(event.startAt)} ~ {formatTime(event.endAt)}</span>
                      )}
                      {event.isRecurring && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '2px',
                          color: '#8b5cf6', fontSize: '11px',
                        }}>
                          <Repeat size={11} />
                          반복
                        </span>
                      )}
                    </div>

                    {/* Content preview */}
                    {event.content && (
                      <div style={{
                        fontSize: '13px', color: secondaryTextColor, marginTop: '2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        opacity: 0.8,
                      }}>
                        {event.content}
                      </div>
                    )}

                    {/* Creator */}
                    {event.creator?.name && (
                      <div style={{ fontSize: '12px', color: secondaryTextColor, marginTop: '4px', opacity: 0.7 }}>
                        {event.creator.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{
            padding: '12px 24px',
            borderTop: `1px solid ${borderColor}`,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
          }}>
            <button
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              style={{
                padding: '6px 14px', borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent', color: page <= 1 ? secondaryTextColor : textColor,
                cursor: page <= 1 ? 'default' : 'pointer',
                fontSize: '13px', opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              이전
            </button>
            <span style={{ fontSize: '13px', color: secondaryTextColor }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              style={{
                padding: '6px 14px', borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent', color: page >= totalPages ? secondaryTextColor : textColor,
                cursor: page >= totalPages ? 'default' : 'pointer',
                fontSize: '13px', opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
