import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const getInitialFormData = (selectedDate) => {
  const dateStr = selectedDate || new Date().toISOString().split('T')[0];
  // 기본 반복 종료일: 3개월 후
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
  const endDateStr = `${threeMonthsLater.getFullYear()}-${String(threeMonthsLater.getMonth() + 1).padStart(2, '0')}-${String(threeMonthsLater.getDate()).padStart(2, '0')}`;

  return {
    title: '',
    content: '',
    startDate: dateStr,
    startTime: '09:00',
    endDate: dateStr,
    endTime: '18:00',
    priority: 'NORMAL',
    isRecurring: false,
    recurrenceType: 'week',
    recurrenceInterval: 1,
    recurrenceEndDate: endDateStr
  };
};

export default function EventModal({ isOpen, onClose, onSuccess, selectedDate }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(() => getInitialFormData(selectedDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const darkMode = true;
  const bgColor = darkMode ? '#0f172a' : '#f1f5f9';
  const cardBg = darkMode ? '#1e293b' : '#fff';
  const textColor = darkMode ? '#e2e8f0' : '#1e293b';
  const borderColor = darkMode ? '#334155' : '#e2e8f0';

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(selectedDate));
      setError('');
      setLoading(false);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 날짜/시간 합치기
      const startAt = `${formData.startDate}T${formData.startTime}:00`;
      const endAt = `${formData.endDate}T${formData.endTime}:00`;

      const eventData = {
        title: formData.title,
        content: formData.content,
        startAt,
        endAt,
        priority: formData.priority
      };

      // 반복 일정인 경우 추가 데이터
      if (formData.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurrenceType = formData.recurrenceType;
        eventData.recurrenceInterval = parseInt(formData.recurrenceInterval, 10);
        eventData.recurrenceEndDate = formData.recurrenceEndDate;
      }

      await api.createEvent(eventData);

      // 성공 후 폼 리셋
      setFormData(getInitialFormData(selectedDate));
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || '일정 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif';

  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${borderColor}`,
    backgroundColor: bgColor,
    color: textColor,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: textColor,
    marginBottom: '8px',
    fontFamily
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: cardBg,
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
            새 일정 만들기
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: textColor,
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* 사용자 정보 표시 */}
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: bgColor,
            marginBottom: '24px',
            fontSize: '14px',
            color: textColor
          }}>
            <strong>작성자:</strong> {user?.division} {user?.office} {user?.department} {user?.position} {user?.name}
          </div>

          {/* 제목 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>제목 *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              style={inputStyle}
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          {/* 내용 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>내용</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleChange}
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical'
              }}
              placeholder="일정 내용을 입력하세요"
            />
          </div>

          {/* 시작 날짜/시간 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div>
              <label style={labelStyle}>시작 날짜 *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>시작 시간 *</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* 종료 날짜/시간 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div>
              <label style={labelStyle}>종료 날짜 *</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>종료 시간 *</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* 우선순위 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>우선순위</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="LOW">낮음</option>
              <option value="NORMAL">보통</option>
              <option value="HIGH">높음</option>
            </select>
          </div>

          {/* 반복 일정 토글 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontFamily
            }}>
              <input
                type="checkbox"
                name="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#3B82F6'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: textColor }}>
                반복 일정으로 등록
              </span>
            </label>
          </div>

          {/* 반복 일정 설정 (토글 시 표시) */}
          {formData.isRecurring && (
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: bgColor,
              marginBottom: '24px',
              border: `1px solid ${borderColor}`
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>반복 주기</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    name="recurrenceInterval"
                    value={formData.recurrenceInterval}
                    onChange={handleChange}
                    min="1"
                    max="99"
                    style={{
                      ...inputStyle,
                      width: '80px',
                      textAlign: 'center'
                    }}
                  />
                  <select
                    name="recurrenceType"
                    value={formData.recurrenceType}
                    onChange={handleChange}
                    style={{
                      ...inputStyle,
                      width: 'auto',
                      flex: 1
                    }}
                  >
                    <option value="day">일마다</option>
                    <option value="week">주마다</option>
                    <option value="month">개월마다</option>
                    <option value="year">년마다</option>
                  </select>
                </div>
                <p style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontFamily
                }}>
                  {formData.recurrenceInterval === '1' || formData.recurrenceInterval === 1
                    ? `매${formData.recurrenceType === 'day' ? '일' : formData.recurrenceType === 'week' ? '주' : formData.recurrenceType === 'month' ? '월' : '년'} 반복`
                    : `${formData.recurrenceInterval}${formData.recurrenceType === 'day' ? '일' : formData.recurrenceType === 'week' ? '주' : formData.recurrenceType === 'month' ? '개월' : '년'}마다 반복`
                  }
                </p>
              </div>

              <div>
                <label style={labelStyle}>반복 종료일 *</label>
                <input
                  type="date"
                  name="recurrenceEndDate"
                  value={formData.recurrenceEndDate}
                  onChange={handleChange}
                  required={formData.isRecurring}
                  min={formData.startDate}
                  style={inputStyle}
                />
                <p style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontFamily
                }}>
                  이 날짜까지 반복됩니다
                </p>
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: `1px solid ${borderColor}`,
                backgroundColor: 'transparent',
                color: textColor,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#1e40af' : '#3B82F6',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily
              }}
            >
              {loading ? '생성 중...' : '일정 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
