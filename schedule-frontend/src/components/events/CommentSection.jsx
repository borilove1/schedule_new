import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Send, Edit2, Trash2, X, Check } from 'lucide-react';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useActionGuard } from '../../hooks/useActionGuard';
import { getRelativeTime } from '../../utils/mockNotifications';
import { api } from '../../utils/api';
import ConfirmDialog from '../common/ConfirmDialog';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Pretendard", "Inter", "Segoe UI", sans-serif';

export default function CommentSection({ eventId, currentUser, canEdit }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [hoveredAction, setHoveredAction] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const { isDarkMode, textColor, secondaryTextColor, inputBg, borderColor, hoverBg, errorColor } = useThemeColors();
  const actionGuard = useActionGuard();

  // series-* 형식에서 seriesId 추출
  const isSeriesEvent = String(eventId).startsWith('series-');
  const seriesId = isSeriesEvent ? String(eventId).split('-')[1] : null;

  const loadComments = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      let data;
      if (isSeriesEvent) {
        data = await api.getSeriesComments(seriesId);
      } else {
        data = await api.getEventComments(eventId);
      }
      setComments(data?.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('댓글을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [eventId, isSeriesEvent, seriesId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await actionGuard.execute(async () => {
      setError('');
      try {
        if (isSeriesEvent) {
          await api.addSeriesComment(seriesId, newComment.trim());
        } else {
          await api.addEventComment(eventId, newComment.trim());
        }
        setNewComment('');
        if (newCommentRef.current) {
          newCommentRef.current.style.height = 'auto';
        }
        await loadComments();
      } catch (err) {
        setError(err.message || '댓글 작성에 실패했습니다.');
      }
    });
  };

  const handleStartEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    await actionGuard.execute(async () => {
      setError('');
      try {
        await api.updateComment(commentId, editContent.trim());
        setEditingId(null);
        setEditContent('');
        await loadComments();
      } catch (err) {
        setError(err.message || '댓글 수정에 실패했습니다.');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const commentId = deleteConfirmId;
    setDeleteConfirmId(null);

    await actionGuard.execute(async () => {
      setError('');
      try {
        await api.deleteComment(commentId);
        await loadComments();
      } catch (err) {
        setError(err.message || '댓글 삭제에 실패했습니다.');
      }
    });
  };

  const canEditComment = (comment) => {
    const authorId = comment.author_id || comment.authorId;
    return authorId === currentUser?.id;
  };

  const canDeleteComment = (comment) => {
    const authorId = comment.author_id || comment.authorId;
    return authorId === currentUser?.id || currentUser?.role === 'ADMIN';
  };

  const getAuthorName = (comment) => comment.author_name || comment.authorName || '?';
  const getIsEdited = (comment) => comment.is_edited || comment.isEdited;
  const getCreatedAt = (comment) => comment.created_at || comment.createdAt;

  const inProgress = actionGuard.inProgress;
  const newCommentRef = useRef(null);
  const editCommentRef = useRef(null);

  // textarea 자동 높이 조절
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  // 아바타 색상 배열 (작성자별 다른 색상)
  const avatarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  return (
    <div style={{
      marginTop: '24px',
      paddingTop: '20px',
      borderTop: `1px solid ${borderColor}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <MessageCircle size={18} color="#3B82F6" />
        <span style={{
          fontSize: '15px',
          fontWeight: '600',
          color: textColor,
          fontFamily: FONT_FAMILY,
        }}>
          댓글
        </span>
        <span style={{
          fontSize: '13px',
          color: secondaryTextColor,
          fontWeight: '500',
        }}>
          ({comments.length})
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: isDarkMode ? '#7f1d1d' : '#fef2f2',
          color: errorColor,
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: secondaryTextColor,
          fontSize: '14px',
        }}>
          댓글 로딩 중...
        </div>
      ) : comments.length === 0 ? (
        <div style={{
          padding: '28px 16px',
          textAlign: 'center',
          backgroundColor: inputBg,
          borderRadius: '10px',
          marginBottom: '16px',
        }}>
          <MessageCircle
            size={28}
            style={{
              margin: '0 auto 8px',
              display: 'block',
              opacity: 0.25,
              color: secondaryTextColor,
            }}
          />
          <p style={{
            fontSize: '13px',
            color: secondaryTextColor,
            margin: 0,
            opacity: 0.8,
          }}>
            아직 댓글이 없습니다.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {comments.map((comment) => {
            const authorName = getAuthorName(comment);
            const avatarColor = getAvatarColor(authorName);
            const isEditing = editingId === comment.id;

            return (
              <div
                key={comment.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: inputBg,
                  border: `1px solid ${borderColor}`,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Author & Time & Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: isEditing ? '10px' : '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: avatarColor,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600',
                      flexShrink: 0,
                      fontFamily: FONT_FAMILY,
                    }}>
                      {authorName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: textColor,
                          fontFamily: FONT_FAMILY,
                        }}>
                          {authorName}
                        </span>
                        {getIsEdited(comment) && (
                          <span style={{
                            fontSize: '11px',
                            color: secondaryTextColor,
                            opacity: 0.7,
                          }}>
                            (수정됨)
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: secondaryTextColor,
                        opacity: 0.8,
                        marginTop: '1px',
                      }}>
                        {getRelativeTime(getCreatedAt(comment))}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isEditing && (canEditComment(comment) || canDeleteComment(comment)) && (
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {canEditComment(comment) && (
                        <button
                          onClick={() => handleStartEdit(comment)}
                          disabled={inProgress}
                          onMouseEnter={() => setHoveredAction(`edit-${comment.id}`)}
                          onMouseLeave={() => setHoveredAction(null)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: hoveredAction === `edit-${comment.id}` ? hoverBg : 'transparent',
                            color: secondaryTextColor,
                            cursor: inProgress ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: inProgress ? 0.4 : 0.7,
                            transition: 'all 0.15s',
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canDeleteComment(comment) && (
                        <button
                          onClick={() => setDeleteConfirmId(comment.id)}
                          disabled={inProgress}
                          onMouseEnter={() => setHoveredAction(`del-${comment.id}`)}
                          onMouseLeave={() => setHoveredAction(null)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: hoveredAction === `del-${comment.id}` ? (isDarkMode ? '#7f1d1d' : '#fef2f2') : 'transparent',
                            color: '#ef4444',
                            cursor: inProgress ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: inProgress ? 0.4 : 0.7,
                            transition: 'all 0.15s',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                {isEditing ? (
                  <div>
                    <textarea
                      ref={editCommentRef}
                      value={editContent}
                      onChange={(e) => {
                        setEditContent(e.target.value);
                        autoResize(e.target);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${borderColor}`,
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        color: textColor,
                        fontSize: '14px',
                        fontFamily: FONT_FAMILY,
                        resize: 'none',
                        minHeight: '60px',
                        marginBottom: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                        lineHeight: '1.5',
                        overflow: 'hidden',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3B82F6';
                        autoResize(e.target);
                      }}
                      onBlur={(e) => { e.target.style.borderColor = borderColor; }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${borderColor}`,
                          backgroundColor: 'transparent',
                          color: textColor,
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          fontFamily: FONT_FAMILY,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <X size={14} />
                        취소
                      </button>
                      <button
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={!editContent.trim() || inProgress}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: (!editContent.trim() || inProgress) ? (isDarkMode ? '#334155' : '#cbd5e1') : '#3B82F6',
                          color: '#fff',
                          cursor: (!editContent.trim() || inProgress) ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          fontFamily: FONT_FAMILY,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          opacity: (!editContent.trim() || inProgress) ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Check size={14} />
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '14px',
                    color: textColor,
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: FONT_FAMILY,
                  }}>
                    {comment.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Comment Form */}
      {canEdit && (
        <form onSubmit={handleAddComment}>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}>
            <div style={{ flex: 1 }}>
              <textarea
                ref={newCommentRef}
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  autoResize(e.target);
                }}
                placeholder="댓글을 입력하세요..."
                disabled={inProgress}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim()) handleAddComment(e);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: inputBg,
                  color: textColor,
                  fontSize: '14px',
                  fontFamily: FONT_FAMILY,
                  resize: 'none',
                  minHeight: '42px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  opacity: inProgress ? 0.5 : 1,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  lineHeight: '1.5',
                  overflow: 'hidden',
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
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || inProgress}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: (!newComment.trim() || inProgress) ? (isDarkMode ? '#334155' : '#e2e8f0') : '#3B82F6',
                color: (!newComment.trim() || inProgress) ? secondaryTextColor : '#fff',
                cursor: (!newComment.trim() || inProgress) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '42px',
                height: '42px',
                opacity: (!newComment.trim() || inProgress) ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              <Send size={16} />
            </button>
          </div>
          <div style={{
            fontSize: '11px',
            color: secondaryTextColor,
            opacity: 0.6,
            marginTop: '6px',
            paddingLeft: '2px',
          }}>
            Enter로 전송, Shift+Enter로 줄바꿈
          </div>
        </form>
      )}

      {/* 댓글 삭제 확인 다이얼로그 */}
      {deleteConfirmId && (
        <ConfirmDialog
          title="댓글 삭제"
          message="정말 이 댓글을 삭제하시겠습니까?"
          actions={[{ label: '삭제', onClick: handleDeleteConfirm, variant: 'danger' }]}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
