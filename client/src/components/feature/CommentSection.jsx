import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getComments, createComment, deleteComment } from '../../api/feed';
import styles from './CommentSection.module.css';

const INITIAL_SHOW = 5;

function AvatarSmall({ src }) {
  if (src) {
    return <img src={src} alt="" className={styles.avatar} />;
  }
  return (
    <div className={styles.avatarPlaceholder}>
      <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

function CommentItem({ comment, currentUserId, onDelete, onReply, isReply, mentionTarget }) {
  const isOwner = comment.author.id === currentUserId;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = async () => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteComment(comment.id);
      onDelete(comment.id);
    } catch (err) {
      setDeleteError(err.response?.data?.error?.message || '댓글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`${styles.commentItemWrapper} ${isReply ? styles.replyItem : ''}`}>
      <div className={styles.commentItem}>
        <AvatarSmall src={comment.author.profile_image} />
        <div className={styles.commentBody}>
          <div className={styles.commentBubble}>
            <span className={styles.commentAuthor}>{comment.author.name}</span>
            <span className={styles.commentHandle}>@{comment.author.handle}</span>
            <p className={styles.commentContent}>
              {mentionTarget && (
                <span className={styles.mention}>@{mentionTarget.handle}</span>
              )}
              {mentionTarget && ' '}
              {comment.content}
            </p>
          </div>
          <div className={styles.commentActions}>
            <button
              type="button"
              className={styles.replyBtn}
              onClick={() => onReply(comment)}
            >
              답글
            </button>
          </div>
        </div>
        {isOwner && (
          <button
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={deleting}
            aria-label="댓글 삭제"
          >
            {deleting ? '···' : '✕'}
          </button>
        )}
      </div>
      {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
    </div>
  );
}

export default function CommentSection({ postId, onCommentAdded, onCommentDeleted }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { parentId, author }

  useEffect(() => {
    let cancelled = false;
    const fetchComments = async () => {
      setCommentsLoading(true);
      setCommentsError('');
      try {
        const res = await getComments(postId);
        if (!cancelled) {
          setComments(res.data.data.comments || []);
        }
      } catch (err) {
        if (!cancelled) {
          setCommentsError(err.response?.data?.error?.message || '댓글을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };
    fetchComments();
    return () => { cancelled = true; };
  }, [postId]);

  // 댓글을 2단 구조로 그룹화. 깊이 무관하게 모든 자손은 루트 밑에 평탄화.
  // 대댓글이 다른 대댓글에 달린 경우 mentionTarget(바로 위 부모의 author)을 부여해 화살표 멘션 표시.
  const { rootComments, repliesByRoot } = useMemo(() => {
    const byId = new Map(comments.map((c) => [c.id, c]));
    const roots = comments.filter((c) => !c.parent_id);
    const replies = new Map();

    comments
      .filter((c) => c.parent_id)
      .forEach((reply) => {
        // 1) 루트까지 거슬러 올라가 그룹 식별
        let current = reply;
        let guard = 0;
        while (current.parent_id && guard < 100) {
          const parent = byId.get(current.parent_id);
          if (!parent) break;
          current = parent;
          guard++;
        }
        const rootId = current.id;

        // 2) 바로 위 부모가 루트가 아니라면(=다른 대댓글이라면) 그 부모를 멘션 대상으로
        const directParent = byId.get(reply.parent_id);
        const mentionTarget =
          directParent && directParent.parent_id ? directParent.author : null;

        if (!replies.has(rootId)) replies.set(rootId, []);
        replies.get(rootId).push({ ...reply, _mentionTarget: mentionTarget });
      });

    // 대댓글은 오래된 순으로 정렬
    replies.forEach((list) =>
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    );

    return { rootComments: roots, repliesByRoot: replies };
  }, [comments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await createComment(postId, trimmed, replyingTo?.parentId || null);
      const newComment = res.data.data.comment;
      setComments((prev) => [...prev, newComment]);
      setInputValue('');
      setReplyingTo(null);
      onCommentAdded();
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || '댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (comment) => {
    // parent_id는 항상 클릭한 댓글의 id (시각적으로는 2단 평탄화되지만
    // parent_id를 보존해야 누구에게 답글한 것인지 @멘션으로 표시 가능)
    setReplyingTo({ parentId: comment.id, author: comment.author });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleDelete = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentDeleted();
  };

  const visibleRoots = showAll ? rootComments : rootComments.slice(0, INITIAL_SHOW);
  const hasMore = rootComments.length > INITIAL_SHOW && !showAll;

  return (
    <div className={styles.section}>
      {/* 댓글 로딩/에러 */}
      {commentsLoading && (
        <p className={styles.loadingMsg}>댓글 불러오는 중...</p>
      )}
      {commentsError && (
        <p className={styles.error} role="alert">{commentsError}</p>
      )}

      {/* 댓글 목록 */}
      {!commentsLoading && rootComments.length > 0 && (
        <div className={styles.list}>
          {visibleRoots.map((root) => (
            <div key={root.id} className={styles.commentGroup}>
              <CommentItem
                comment={root}
                currentUserId={user?.id}
                onDelete={handleDelete}
                onReply={handleReply}
                isReply={false}
              />
              {(repliesByRoot.get(root.id) || []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={user?.id}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isReply={true}
                  mentionTarget={reply._mentionTarget}
                />
              ))}
            </div>
          ))}
          {hasMore && (
            <button
              className={styles.showMoreBtn}
              onClick={() => setShowAll(true)}
            >
              댓글 {rootComments.length - INITIAL_SHOW}개 더 보기
            </button>
          )}
        </div>
      )}

      {!commentsLoading && !commentsError && rootComments.length === 0 && (
        <p className={styles.emptyMsg}>첫 댓글을 남겨보세요.</p>
      )}

      {/* 답글 대상 배너 */}
      {replyingTo && (
        <div className={styles.replyBanner}>
          <span>
            <strong>{replyingTo.author.name}</strong>
            <span className={styles.replyBannerHandle}>@{replyingTo.author.handle}</span>
            님에게 답글
          </span>
          <button
            type="button"
            className={styles.cancelReplyBtn}
            onClick={handleCancelReply}
          >
            취소
          </button>
        </div>
      )}

      {/* 댓글 입력 */}
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <AvatarSmall src={user?.profile_image} />
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder={replyingTo ? `${replyingTo.author.name}님에게 답글 작성...` : '댓글을 입력하세요...'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!submitting && inputValue.trim()) handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !inputValue.trim()}
          >
            {submitting ? '···' : replyingTo ? '답글' : '게시'}
          </button>
        </div>
      </form>

      {submitError && <p className={styles.error}>{submitError}</p>}
    </div>
  );
}
