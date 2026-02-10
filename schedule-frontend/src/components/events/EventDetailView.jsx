import React from 'react';
import { Edit2, Trash2, Check, Calendar, Clock, Repeat, Eye, Users } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getStatusColor, getStatusText, getRecurrenceDescription } from '../../utils/eventHelpers';
import ErrorAlert from '../common/ErrorAlert';
import CommentSection from './CommentSection';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif';

export default function EventDetailView({
  event, currentUser, onEdit, onDelete, onComplete, loading, actionInProgress, error, eventId, rateLimitCountdown = 0
}) {
  const { isDarkMode, textColor, secondaryTextColor, inputBg } = useThemeColors();
  const isMobile = useIsMobile();

  const isOwner = event.isOwner ?? (event.creator?.id === currentUser?.id);
  const canEdit = event.canEdit ?? isOwner;
  const recurrenceDesc = getRecurrenceDescription(event);

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: isMobile ? '10px' : '16px' }}>
        <div style={{
          display: 'inline-block', padding: isMobile ? '4px 10px' : '6px 12px', borderRadius: '6px',
          backgroundColor: getStatusColor(event.status), color: '#fff', fontSize: '13px', fontWeight: '600'
        }}>
          {getStatusText(event.status)}
        </div>
        {!canEdit && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: isMobile ? '4px 10px' : '6px 12px', borderRadius: '6px',
            backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
            color: secondaryTextColor, fontSize: '13px', fontWeight: '500'
          }}>
            <Eye size={14} />
            조회 전용
          </div>
        )}
      </div>

      <h3 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '600', marginBottom: isMobile ? '10px' : '16px', color: textColor }}>
        제목: {event.title || '(없음)'}
      </h3>

      {event.content && (
        <div style={{
          padding: isMobile ? '10px 12px' : '16px', borderRadius: '8px', backgroundColor: inputBg,
          marginBottom: isMobile ? '10px' : '16px', color: textColor, whiteSpace: 'pre-wrap',
          fontSize: isMobile ? '14px' : undefined,
        }}>
          {event.content}
        </div>
      )}

      {/* 일정 정보 카드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: isMobile ? '8px' : '12px',
        marginBottom: isMobile ? '10px' : '16px'
      }}>
        <div style={{
          padding: isMobile ? '10px' : '14px',
          borderRadius: isMobile ? '8px' : '10px',
          backgroundColor: inputBg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Calendar size={isMobile ? 13 : 15} color="#3B82F6" />
            <span style={{ fontSize: isMobile ? '11px' : '12px', color: secondaryTextColor, fontWeight: '500' }}>날짜</span>
          </div>
          <div style={{ fontSize: isMobile ? '13px' : '14px', color: textColor, fontWeight: '500' }}>
            {event.startAt ? new Date(event.startAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
          </div>
          {event.startAt && event.endAt && new Date(event.startAt).toDateString() !== new Date(event.endAt).toDateString() && (
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: secondaryTextColor, marginTop: '2px' }}>
              ~ {new Date(event.endAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{
          padding: isMobile ? '10px' : '14px',
          borderRadius: isMobile ? '8px' : '10px',
          backgroundColor: inputBg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Clock size={isMobile ? 13 : 15} color="#3B82F6" />
            <span style={{ fontSize: isMobile ? '11px' : '12px', color: secondaryTextColor, fontWeight: '500' }}>시간</span>
          </div>
          <div style={{ fontSize: isMobile ? '13px' : '14px', color: textColor, fontWeight: '500' }}>
            {event.startAt && event.endAt
              ? `${new Date(event.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~ ${new Date(event.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
              : '-'}
          </div>
        </div>
      </div>

      {/* 작성자 + 반복/공유 정보 */}
      <div style={{ marginBottom: isMobile ? '10px' : '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', marginBottom: recurrenceDesc || (event.sharedOffices?.length > 0) ? (isMobile ? '6px' : '10px') : '0' }}>
          <div style={{
            width: isMobile ? '28px' : '32px',
            height: isMobile ? '28px' : '32px',
            borderRadius: '50%',
            backgroundColor: '#3B82F6',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: '600',
            flexShrink: 0,
          }}>
            {(event.creator?.name || '?').charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '500', color: textColor }}>
              {event.creator?.name || '알 수 없음'}
            </div>
            {event.department && (
              <div style={{ fontSize: isMobile ? '11px' : '12px', color: secondaryTextColor }}>{event.department}</div>
            )}
          </div>
        </div>
        {recurrenceDesc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3B82F6', fontSize: isMobile ? '13px' : '14px', marginBottom: '4px' }}>
            <Repeat size={isMobile ? 14 : 16} /><span>{recurrenceDesc}</span>
          </div>
        )}
        {event.sharedOffices && event.sharedOffices.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#8B5CF6', fontSize: isMobile ? '13px' : '14px' }}>
            <Users size={isMobile ? 14 : 16} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>공유: {event.sharedOffices.map(o => {
              const name = o.name || o.officeName || o.office_name || '';
              const dept = o.departmentName || o.department_name || '';
              const pos = o.positions;
              let label = name;
              if (dept) label += ` > ${dept}`;
              if (pos && pos.length > 0) label += ` (${pos.join(', ')})`;
              return label;
            }).join(', ')}</span>
          </div>
        )}
      </div>

      {rateLimitCountdown > 0 ? (
        <div style={{
          padding: '12px', borderRadius: '8px',
          backgroundColor: isDarkMode ? '#7f1d1d' : '#fef2f2',
          color: isDarkMode ? '#fca5a5' : '#dc2626',
          fontSize: '14px', marginBottom: isMobile ? '10px' : '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <span>요청이 너무 많습니다. 잠시 후 다시 시도해주세요.</span>
          <span style={{
            fontWeight: '700', fontSize: '13px',
            backgroundColor: isDarkMode ? '#dc2626' : '#ef4444',
            color: '#fff', borderRadius: '12px', padding: '2px 10px', minWidth: '28px',
            textAlign: 'center', display: 'inline-block',
          }}>
            {rateLimitCountdown}
          </span>
        </div>
      ) : (
        <ErrorAlert message={error} />
      )}

      {canEdit ? (
        <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onComplete}
            disabled={loading || actionInProgress || rateLimitCountdown > 0}
            style={{
              flex: 1, padding: isMobile ? '10px 10px' : '12px 24px', borderRadius: '8px', border: 'none',
              backgroundColor: (loading || actionInProgress || rateLimitCountdown > 0) ? '#64748b' : (event.status === 'DONE' ? '#64748b' : '#10B981'),
              color: '#fff', cursor: (loading || actionInProgress || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '13px' : '14px', fontWeight: '500', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: isMobile ? '4px' : '6px', whiteSpace: 'nowrap',
              opacity: (loading || actionInProgress || rateLimitCountdown > 0) ? 0.5 : 1, fontFamily: FONT_FAMILY
            }}
          >
            <Check size={isMobile ? 15 : 18} />{actionInProgress ? '처리 중...' : (event.status === 'DONE' ? '완료취소' : '완료처리')}
          </button>
          <button
            onClick={onEdit}
            disabled={loading || actionInProgress || rateLimitCountdown > 0}
            style={{
              flex: 1, padding: isMobile ? '10px 10px' : '12px 24px', borderRadius: '8px',
              border: `1px solid ${isDarkMode ? '#475569' : '#cbd5e1'}`,
              backgroundColor: 'transparent', color: textColor,
              cursor: (loading || actionInProgress || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '13px' : '14px', fontWeight: '500', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: isMobile ? '4px' : '6px', whiteSpace: 'nowrap',
              opacity: (loading || actionInProgress || rateLimitCountdown > 0) ? 0.5 : 1, fontFamily: FONT_FAMILY
            }}
          >
            <Edit2 size={isMobile ? 15 : 18} />수정
          </button>
          <button
            onClick={onDelete}
            disabled={loading || actionInProgress || rateLimitCountdown > 0}
            style={{
              padding: isMobile ? '10px 10px' : '12px 24px', borderRadius: '8px', border: 'none',
              backgroundColor: (loading || actionInProgress || rateLimitCountdown > 0) ? '#991b1b' : '#ef4444',
              color: '#fff', cursor: (loading || actionInProgress || rateLimitCountdown > 0) ? 'not-allowed' : 'pointer',
              fontSize: isMobile ? '13px' : '14px', fontWeight: '500', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: isMobile ? '4px' : '6px', whiteSpace: 'nowrap',
              opacity: (loading || actionInProgress || rateLimitCountdown > 0) ? 0.5 : 1, fontFamily: FONT_FAMILY
            }}
          >
            <Trash2 size={isMobile ? 15 : 18} />삭제
          </button>
        </div>
      ) : (
        <div style={{
          padding: '12px', borderRadius: '8px',
          backgroundColor: isDarkMode ? '#334155' : '#f1f5f9',
          color: secondaryTextColor, fontSize: '14px', textAlign: 'center'
        }}>
          다른 사용자의 일정은 조회만 가능합니다.
        </div>
      )}

      {/* 댓글 섹션 - 일정을 볼 수 있으면 댓글 작성 가능 */}
      <CommentSection
        eventId={eventId}
        currentUser={currentUser}
        canComment={true}
        rateLimitCountdown={rateLimitCountdown}
      />
    </>
  );
}
