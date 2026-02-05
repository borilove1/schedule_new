import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2, Trash2, Check, Calendar, Clock, User } from 'lucide-react';
import api from '../../utils/api';

export default function EventDetailModal({ isOpen, onClose, eventId, onSuccess }) {
  const [event, setEvent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false); // UI용
  const actionInProgressRef = useRef(false); // 중복 클릭 방지용 ref
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: ''
  });

  const darkMode = true;
  const bgColor = '#0f172a';
  const cardBg = '#1e293b';
  const textColor = '#e2e8f0';
  const secondaryTextColor = '#94a3b8';
  const borderColor = '#334155';

  useEffect(() => {
    if (isOpen && eventId) {
      loadEvent();
    }
  }, [isOpen, eventId]);

  const formatDateTimeForInput = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { date: '', time: '' };
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
    } catch (err) {
      return { date: '', time: '' };
    }
  };

  const loadEvent = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await api.getEvent(eventId);

      // 데이터 검증 및 설정
      if (data && data.id) {
        setEvent(data);
        const start = formatDateTimeForInput(data.startAt);
        const end = formatDateTimeForInput(data.endAt);
        setFormData({
          title: data.title || '',
          content: data.content || '',
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time
        });
      } else {
        setError('일정 데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (actionInProgressRef.current) return; // 중복 방지

    setError('');
    setLoading(true);
    setActionInProgress(true);
    actionInProgressRef.current = true;

    try {
      if (!formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
        setError('모든 날짜와 시간을 입력해주세요.');
        return;
      }
      const startAt = `${formData.startDate}T${formData.startTime}:00`;
      const endAt = `${formData.endDate}T${formData.endTime}:00`;
      await api.updateEvent(eventId, {
        title: formData.title,
        content: formData.content,
        startAt,
        endAt,
        priority: 'NORMAL'
      });
      setIsEditing(false);
      onSuccess();
      await loadEvent();
    } catch (err) {
      setError(err.message || '일정 수정에 실패했습니다.');
    } finally {
      setLoading(false);
      setActionInProgress(false);
      actionInProgressRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (actionInProgressRef.current) return; // 중복 방지

    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) return;

    setLoading(true);
    setActionInProgress(true);
    actionInProgressRef.current = true;

    try {
      await api.deleteEvent(eventId);
      onSuccess();
      onClose();
    } catch (err) {
      setError('일정 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
      setActionInProgress(false);
      actionInProgressRef.current = false;
    }
  };

  const handleComplete = async () => {
    if (actionInProgressRef.current) return; // 중복 방지

    setLoading(true);
    setActionInProgress(true);
    actionInProgressRef.current = true;
    setError('');

    try {
      if (event.status === 'DONE') {
        await api.uncompleteEvent(eventId);
      } else {
        await api.completeEvent(eventId);
      }

      // 상태 업데이트 후 일정 다시 로드
      await loadEvent();
      onSuccess();

    } catch (err) {
      setError(err.message || '상태 변경에 실패했습니다.');
    } finally {
      setLoading(false);
      setActionInProgress(false);
      actionInProgressRef.current = false;
    }
  };

  if (!isOpen) return null;

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

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif';
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${borderColor}`, backgroundColor: bgColor, color: textColor, fontSize: '14px', outline: 'none', fontFamily };
  const labelStyle = { display: 'block', fontSize: '14px', fontWeight: '500', color: textColor, marginBottom: '8px', fontFamily };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ backgroundColor: cardBg, borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif' }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: textColor }}>{isEditing ? '일정 수정' : '일정 상세'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer' }}><X size={24} /></button>
        </div>
        {loading && !event ? (
          <div style={{ padding: '40px', textAlign: 'center', color: secondaryTextColor }}>로딩 중...</div>
        ) : event ? (
          <div style={{ padding: '24px' }}>
            {!isEditing ? (
              <>
                <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', backgroundColor: getStatusColor(event.status), color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>{getStatusText(event.status)}</div>
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: textColor }}>제목: {event.title || '(없음)'}</h3>
                {event.content && <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: bgColor, marginBottom: '16px', color: textColor, whiteSpace: 'pre-wrap' }}>{event.content}</div>}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: secondaryTextColor, fontSize: '14px', marginBottom: '8px' }}>
                    <Calendar size={16} /><span>{event.startAt ? new Date(event.startAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: secondaryTextColor, fontSize: '14px', marginBottom: '8px' }}>
                    <Clock size={16} /><span>{event.startAt && event.endAt ? `${new Date(event.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~ ${new Date(event.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: secondaryTextColor, fontSize: '14px' }}>
                    <User size={16} /><span>{event.creator?.name || '알 수 없음'} {event.department && `(${event.department})`}</span>
                  </div>
                </div>
                {error && <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}
                {actionInProgress && <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#1e40af', color: '#93c5fd', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>처리 중...</div>}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button onClick={handleComplete} disabled={loading || actionInProgress} style={{ flex: 1, padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: (loading || actionInProgress) ? '#64748b' : (event.status === 'DONE' ? '#64748b' : '#10B981'), color: '#fff', cursor: (loading || actionInProgress) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (loading || actionInProgress) ? 0.5 : 1, fontFamily }}><Check size={18} />{event.status === 'DONE' ? '완료 취소' : '완료 처리'}</button>
                  <button onClick={() => setIsEditing(true)} disabled={loading || actionInProgress} style={{ flex: 1, padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderColor}`, backgroundColor: 'transparent', color: textColor, cursor: (loading || actionInProgress) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (loading || actionInProgress) ? 0.5 : 1, fontFamily }}><Edit2 size={18} />수정</button>
                  <button onClick={handleDelete} disabled={loading || actionInProgress} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: (loading || actionInProgress) ? '#991b1b' : '#ef4444', color: '#fff', cursor: (loading || actionInProgress) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (loading || actionInProgress) ? 0.5 : 1, fontFamily }}><Trash2 size={18} />삭제</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleUpdate}>
                <div style={{ marginBottom: '20px' }}><label style={labelStyle}>제목 *</label><input type="text" name="title" value={formData.title} onChange={handleChange} required style={inputStyle} /></div>
                <div style={{ marginBottom: '20px' }}><label style={labelStyle}>내용</label><textarea name="content" value={formData.content} onChange={handleChange} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div><label style={labelStyle}>시작 날짜 *</label><input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required style={inputStyle} /></div>
                  <div><label style={labelStyle}>시작 시간 *</label><input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div><label style={labelStyle}>종료 날짜 *</label><input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required style={inputStyle} /></div>
                  <div><label style={labelStyle}>종료 시간 *</label><input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required style={inputStyle} /></div>
                </div>
                {error && <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#7f1d1d', color: '#fca5a5', fontSize: '14px', marginBottom: '20px' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: `1px solid ${borderColor}`, backgroundColor: 'transparent', color: textColor, cursor: 'pointer', fontSize: '14px', fontWeight: '500', fontFamily }}>취소</button>
                  <button type="submit" disabled={loading || actionInProgress} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: (loading || actionInProgress) ? '#1e40af' : '#3B82F6', color: '#fff', cursor: (loading || actionInProgress) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500', fontFamily }}>{(loading || actionInProgress) ? '저장 중...' : '저장'}</button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: secondaryTextColor }}>일정을 찾을 수 없습니다.</div>
        )}
      </div>
    </div>
  );
}
