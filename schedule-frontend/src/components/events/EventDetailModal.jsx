import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useActionGuard } from '../../hooks/useActionGuard';
import { useSwipeDown } from '../../hooks/useSwipeDown';
import { formatDateTimeForInput } from '../../utils/eventHelpers';
import EventDetailView from './EventDetailView';
import EventEditForm from './EventEditForm';
import ConfirmDialog from '../common/ConfirmDialog';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif';

export default function EventDetailModal({ isOpen, onClose, eventId, onSuccess, rateLimitCountdown = 0, onRateLimitStart }) {
  const { user: currentUser } = useAuth();
  const { refreshNotifications } = useNotification();
  const { isDarkMode, cardBg, textColor, secondaryTextColor, borderColor } = useThemeColors();
  const isMobile = useIsMobile();
  const actionGuard = useActionGuard();

  const isRateLimitError = (msg) => msg && (msg.includes('너무 많은 요청') || msg.includes('RATE_LIMIT'));

  const [event, setEvent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDialog, setActiveDialog] = useState(null);
  const [editType, setEditType] = useState('this');
  const [offices, setOffices] = useState([]);
  const [sharedTargets, setSharedTargets] = useState([]); // [{ officeId, officeName, departmentId, departmentName, positions }]
  const [formData, setFormData] = useState({
    title: '', content: '', priority: 'NORMAL',
    startDate: '', startTime: '', endDate: '', endTime: '',
    isRecurring: false, recurrenceType: 'week', recurrenceInterval: 1, recurrenceEndDate: ''
  });
  const [newFiles, setNewFiles] = useState([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);
  const [preloadedComments, setPreloadedComments] = useState(null);

  // 댓글 로드 헬퍼 (일정 로드와 병렬 실행용)
  const fetchComments = useCallback(async (eid) => {
    try {
      const isSeriesEvent = String(eid).startsWith('series-');
      if (isSeriesEvent) {
        const seriesId = String(eid).split('-')[1];
        const occurrenceDate = new Date(parseInt(String(eid).split('-')[2], 10)).toISOString().split('T')[0];
        const data = await api.getSeriesComments(seriesId, occurrenceDate);
        return data?.comments || [];
      } else {
        const data = await api.getEventComments(eid);
        return data?.comments || [];
      }
    } catch {
      return null; // 실패 시 CommentSection이 자체 로드
    }
  }, []);

  useEffect(() => {
    if (isOpen && eventId) {
      setIsEditing(false);
      setError('');
      setActiveDialog(null);
      setEditType('this');
      setSharedTargets([]);
      setNewFiles([]);
      setDeletedAttachmentIds([]);
      setPreloadedComments(null);
      actionGuard.reset();
      loadEvent();
      if (currentUser?.divisionId) {
        api.getOffices(currentUser.divisionId).then(data => {
          const list = data?.offices || data || [];
          setOffices(Array.isArray(list) ? list : []);
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      setError('');
      // 일정 + 댓글 병렬 로드
      const [data, comments] = await Promise.all([
        api.getEvent(eventId),
        fetchComments(eventId)
      ]);
      if (data && data.id) {
        setEvent(data);
        setPreloadedComments(comments);
        const start = formatDateTimeForInput(data.startAt);
        const end = formatDateTimeForInput(data.endAt);
        setFormData({
          title: data.title || '', content: data.content || '',
          priority: data.priority || 'NORMAL',
          startDate: start.date, startTime: start.time,
          endDate: end.date, endTime: end.time,
          isRecurring: !!(data.isRecurring || data.seriesId),
          recurrenceType: data.recurrenceType || 'week',
          recurrenceInterval: data.recurrenceInterval || 1,
          recurrenceEndDate: data.recurrenceEndDate
            ? new Date(data.recurrenceEndDate).toISOString().split('T')[0] : ''
        });
        if (data.sharedOffices && Array.isArray(data.sharedOffices)) {
          setSharedTargets(data.sharedOffices.map(o => ({
            officeId: o.id || o.officeId || o.office_id,
            officeName: o.name || o.officeName || '',
            departmentId: o.departmentId || o.department_id || null,
            departmentName: o.departmentName || o.department_name || null,
            positions: o.positions || null
          })));
        }
      } else {
        setError('일정 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      const msg = err.message || '';
      setError(`오류: ${msg}`);
      if (isRateLimitError(msg) && onRateLimitStart) onRateLimitStart(60);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    await actionGuard.execute(async () => {
      setError('');
      setLoading(true);
      try {
        if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
          setError('모든 날짜와 시간을 입력해주세요.');
          return;
        }
        const startAt = `${formData.startDate}T${formData.startTime}:00`;
        const endAt = `${formData.endDate}T${formData.endTime}:00`;
        if (new Date(endAt) <= new Date(startAt)) {
          setError('종료 시간은 시작 시간보다 이후여야 합니다.');
          return;
        }

        const updateData = { title: formData.title, content: formData.content, startAt, endAt, priority: formData.priority || 'NORMAL' };
        updateData.sharedTargets = sharedTargets.map(t => ({
          officeId: t.officeId,
          departmentId: t.departmentId || null,
          positions: t.positions || null
        }));
        if (eventId && String(eventId).startsWith('series-')) {
          updateData.editType = editType;
          if (editType === 'all') {
            updateData.recurrenceType = formData.recurrenceType;
            updateData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
            updateData.recurrenceEndDate = formData.recurrenceEndDate || null;
          }
        }
        // 단일 일정 → 반복 일정 변환
        if (formData.isRecurring && !event.seriesId && !String(eventId).startsWith('series-')) {
          updateData.isRecurring = true;
          updateData.recurrenceType = formData.recurrenceType;
          updateData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
          updateData.recurrenceEndDate = formData.recurrenceEndDate || null;
        }

        await api.updateEvent(eventId, updateData);

        // Delete removed attachments
        for (const attId of deletedAttachmentIds) {
          try { await api.deleteAttachment(attId); } catch (e) { console.error('첨부파일 삭제 실패:', e); }
        }

        // Upload new files (시리즈: editType 전달로 전체/이번만 구분)
        if (newFiles.length > 0) {
          try {
            const uploadEditType = String(eventId).startsWith('series-') ? editType : undefined;
            await api.uploadAttachments(eventId, newFiles, uploadEditType);
          } catch (e) { console.error('첨부파일 업로드 실패:', e); }
        }

        setNewFiles([]);
        setDeletedAttachmentIds([]);
        onSuccess();
        refreshNotifications();
        onClose();
      } catch (err) {
        const msg = err.message || '일정 수정에 실패했습니다.';
        setError(msg);
        if (isRateLimitError(msg) && onRateLimitStart) onRateLimitStart(60);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDeleteClick = () => {
    if (actionGuard.isGuarded()) return;
    setActiveDialog('delete');
  };

  const handleDelete = async (deleteType) => {
    await actionGuard.execute(async () => {
      setActiveDialog(null);
      setLoading(true);
      try {
        await api.deleteEvent(eventId, { deleteType });
        onSuccess();
        onClose();
        refreshNotifications();
      } catch (err) {
        const msg = err.message || '일정 삭제에 실패했습니다.';
        setError(msg);
        if (isRateLimitError(msg) && onRateLimitStart) onRateLimitStart(60);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleCompleteClick = () => {
    if (actionGuard.isGuarded()) return;
    const isRecurring = event.seriesId || event.isRecurring || (eventId && String(eventId).startsWith('series-'));
    if (isRecurring && event.status !== 'DONE') {
      setActiveDialog('complete');
    } else {
      executeComplete('this');
    }
  };

  const executeComplete = async (completeType) => {
    await actionGuard.execute(async () => {
      setActiveDialog(null);
      setLoading(true);
      setError('');
      try {
        if (event.status === 'DONE') {
          await api.uncompleteEvent(eventId);
        } else {
          await api.completeEvent(eventId, { completeType });
        }

        if (eventId && String(eventId).startsWith('series-')) {
          onSuccess();
          refreshNotifications();
          onClose();
          return;
        }
        await loadEvent();
        onSuccess();
        refreshNotifications();
      } catch (err) {
        const msg = err.message || '상태 변경에 실패했습니다.';
        setError(msg);
        if (isRateLimitError(msg) && onRateLimitStart) onRateLimitStart(60);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleEditClick = () => {
    if (event.seriesId || event.isRecurring) {
      setActiveDialog('editType');
    } else {
      setEditType('this');
      setIsEditing(true);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await api.deleteAttachment(attachmentId);
      await loadEvent();
      onSuccess();
    } catch (err) {
      const msg = err.message || '첨부파일 삭제에 실패했습니다.';
      setError(msg);
      if (isRateLimitError(msg) && onRateLimitStart) onRateLimitStart(60);
    }
  };

  // ESC 키로 모달 닫기
  // 모달 애니메이션
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsAnimating(false);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300); // transition 시간과 동일
  }, [isClosing, onClose]);

  // 스와이프로 모달 닫기
  const { handleTouchStart, handleTouchMove, handleTouchEnd, swipeStyle, backdropOpacity, contentRef: swipeContentRef } = useSwipeDown(onClose);

  const handleEsc = useCallback((e) => {
    if (e.key === 'Escape') {
      if (activeDialog) {
        setActiveDialog(null);
      } else {
        handleClose();
      }
    }
  }, [handleClose, activeDialog]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, handleEsc]);

  // 모달이 닫히면 애니메이션 상태 초기화 (스와이프 닫기 포함)
  useEffect(() => {
    if (!isOpen) {
      setIsAnimating(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isClosing) {
      // 이중 rAF로 초기 상태 렌더 후 애니메이션 시작
      let raf2;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setIsAnimating(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
  }, [isOpen, isClosing]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-modal-title"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: (isMobile && swipeStyle)
          ? `rgba(0,0,0,${0.7 * backdropOpacity})`
          : (isAnimating ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)'),
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center', zIndex: 1000,
        padding: isMobile ? 0 : '20px',
        paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : '20px',
        transition: (isMobile && swipeStyle) ? 'none' : 'background-color 0.2s ease',
      }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
        backgroundColor: cardBg,
        borderRadius: isMobile ? '20px 20px 0 0' : '16px',
        width: '100%',
        maxWidth: isMobile ? '100%' : '600px',
        maxHeight: isMobile ? 'calc(100% - env(safe-area-inset-top, 0px))' : '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: FONT_FAMILY,
        transform: (isMobile && swipeStyle) ? swipeStyle.transform : (isAnimating ? 'translateY(0)' : (isMobile ? 'translateY(100%)' : 'translateY(20px)')),
        opacity: isMobile ? 1 : (isAnimating ? 1 : 0),
        transition: (isMobile && swipeStyle) ? swipeStyle.transition : (isMobile ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'transform 0.25s ease, opacity 0.2s ease'),
      }}>
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '2px' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: isDarkMode ? '#4a5568' : '#cbd5e0' }} />
          </div>
        )}
        <div style={{
          padding: isMobile ? '12px 20px' : '16px 24px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0
        }}>
          <h2 id="event-detail-modal-title" style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: '600', margin: 0, color: textColor, flex: 1, minWidth: 0 }}>
            {isEditing ? (editType === 'all' ? '반복 일정 수정' : '일정 수정') : '일정 상세'}
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {loading && !event ? (
          <div style={{ flex: 1, padding: '40px', textAlign: 'center', color: secondaryTextColor }}>로딩 중...</div>
        ) : event ? (
          <div ref={swipeContentRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 20px' : '24px' }}>
            {!isEditing ? (
              <EventDetailView
                event={event}
                currentUser={currentUser}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onComplete={handleCompleteClick}
                loading={loading}
                actionInProgress={actionGuard.inProgress}
                error={error}
                eventId={eventId}
                rateLimitCountdown={rateLimitCountdown}
                onDeleteAttachment={handleDeleteAttachment}
                initialComments={preloadedComments}
              />
            ) : (
              <EventEditForm
                formData={formData}
                onChange={handleChange}
                onSubmit={handleUpdate}
                onCancel={onClose}
                editType={editType}
                event={event}
                loading={loading}
                actionInProgress={actionGuard.inProgress}
                error={error}
                offices={offices}
                sharedTargets={sharedTargets}
                onSharedTargetsChange={setSharedTargets}
                onRecurringToggle={() => setFormData(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                rateLimitCountdown={rateLimitCountdown}
                attachments={event?.attachments?.filter(a => !deletedAttachmentIds.includes(a.id)) || []}
                newFiles={newFiles}
                onNewFilesChange={setNewFiles}
                onDeleteExistingAttachment={(id) => setDeletedAttachmentIds(prev => [...prev, id])}
              />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, padding: '40px', textAlign: 'center', color: secondaryTextColor }}>일정을 찾을 수 없습니다.</div>
        )}
      </div>

      {activeDialog === 'editType' && (
        <ConfirmDialog
          title="반복 일정 수정"
          message="이 일정은 반복 일정입니다. 어떻게 수정하시겠습니까?"
          actions={[
            { label: '이번 일정만 수정', onClick: () => { setEditType('this'); setActiveDialog(null); setIsEditing(true); } },
            { label: '전체 반복 일정 수정', variant: 'primary', onClick: () => { setEditType('all'); setActiveDialog(null); setIsEditing(true); } },
          ]}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'complete' && (
        <ConfirmDialog
          title="반복 일정 완료"
          message="이 일정은 반복 일정입니다. 어떻게 완료하시겠습니까?"
          actions={[
            { label: '이번 일정만 완료', onClick: () => executeComplete('this') },
            { label: '반복 일정 전체 완료', variant: 'success', onClick: () => executeComplete('all') },
          ]}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {activeDialog === 'delete' && (
        <ConfirmDialog
          title={event?.seriesId ? '반복 일정 삭제' : '일정 삭제'}
          message={event?.seriesId
            ? '이 일정은 반복 일정입니다. 어떻게 삭제하시겠습니까?'
            : '정말 이 일정을 삭제하시겠습니까?'}
          actions={event?.seriesId ? [
            { label: '이 일정만 삭제', onClick: () => handleDelete('single') },
            { label: '반복일정 전체 삭제', variant: 'danger', onClick: () => handleDelete('series') },
          ] : [
            { label: '삭제', variant: 'danger', onClick: () => handleDelete('single') },
          ]}
          onCancel={() => setActiveDialog(null)}
        />
      )}
    </div>
  );
}
