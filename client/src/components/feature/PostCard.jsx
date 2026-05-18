import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { likePost, unlikePost, deletePost, updatePost } from '../../api/feed';
import CommentSection from './CommentSection';
import styles from './PostCard.module.css';

function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

function AvatarPlaceholder() {
  return (
    <div className={styles.avatarPlaceholder}>
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

function MediaGrid({ urls }) {
  if (!urls || urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className={styles.mediaGrid1}>
        <img src={urls[0]} alt="미디어" className={styles.mediaImg} />
      </div>
    );
  }

  if (urls.length === 2) {
    return (
      <div className={styles.mediaGrid2}>
        {urls.map((url, i) => (
          <img key={i} src={url} alt="미디어" className={styles.mediaImg} />
        ))}
      </div>
    );
  }

  // 3개 이상: 첫 번째 크게 + 나머지 2열 그리드
  return (
    <div className={styles.mediaGridMany}>
      <img src={urls[0]} alt="미디어" className={styles.mediaImgFirst} />
      <div className={styles.mediaGridRest}>
        {urls.slice(1).map((url, i) => (
          <img key={i} src={url} alt="미디어" className={styles.mediaImg} />
        ))}
      </div>
    </div>
  );
}

export default function PostCard({ post, onDelete, onUpdate }) {
  const { user } = useAuth();
  const isOwner = user?.id === post.author.id;

  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeLoading, setLikeLoading] = useState(false);

  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [showComments, setShowComments] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [postError, setPostError] = useState('');

  const handleLikeToggle = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    // 낙관적 업데이트
    const prevLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      if (prevLiked) {
        const res = await unlikePost(post.id);
        setLikeCount(res.data.data.like_count);
      } else {
        const res = await likePost(post.id);
        setLikeCount(res.data.data.like_count);
      }
    } catch {
      // 롤백
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
    setDeleteLoading(true);
    setPostError('');
    try {
      await deletePost(post.id);
      onDelete(post.id);
    } catch (err) {
      setPostError(err.response?.data?.error?.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
      setMenuOpen(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const trimmed = editContent.trim();
    if (!trimmed) return;
    setEditLoading(true);
    setEditError('');
    try {
      const res = await updatePost(post.id, trimmed);
      onUpdate(post.id, res.data.data.post);
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.error?.message || '수정 중 오류가 발생했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCommentAdded = () => {
    setCommentCount((c) => c + 1);
  };

  const handleCommentDeleted = () => {
    setCommentCount((c) => Math.max(0, c - 1));
  };

  return (
    <article className={styles.card}>
      {/* 헤더 */}
      <header className={styles.header}>
        <Link
          to={isOwner ? '/me' : `/users/${post.author.id}`}
          className={styles.authorInfo}
          aria-label={`${post.author.name} 프로필 보기`}
        >
          {post.author.profile_image ? (
            <img src={post.author.profile_image} alt="" className={styles.avatar} />
          ) : (
            <AvatarPlaceholder />
          )}
          <div className={styles.authorMeta}>
            <span className={styles.authorName}>{post.author.name}</span>
            <span className={styles.authorHandle}>@{post.author.handle}</span>
            <span className={styles.postTime}>{formatRelativeTime(post.created_at)}</span>
          </div>
        </Link>

        {isOwner && (
          <div className={styles.menuWrapper}>
            <button
              className={styles.menuBtn}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="게시글 메뉴"
            >
              ···
            </button>
            {menuOpen && (
              <div className={styles.menuDropdown}>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                >
                  수정
                </button>
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={handleDelete}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? '삭제 중...' : '삭제'}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 본문 */}
      <div className={styles.body}>
        {editing ? (
          <form onSubmit={handleEditSubmit} className={styles.editForm}>
            <textarea
              className={styles.editTextarea}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
            />
            {editError && <p className={styles.inlineError}>{editError}</p>}
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  setEditing(false);
                  setEditContent(post.content);
                  setEditError('');
                }}
              >
                취소
              </button>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={editLoading || !editContent.trim()}
              >
                {editLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <p className={styles.content}>{post.content}</p>
        )}
      </div>

      {/* 미디어 */}
      <MediaGrid urls={post.media_urls} />

      {/* 에러 */}
      {postError && <p className={styles.inlineError}>{postError}</p>}

      {/* 액션 바 */}
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${isLiked ? styles.liked : ''}`}
          onClick={handleLikeToggle}
          disabled={likeLoading}
        >
          <span className={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</span>
          <span>{likeCount}</span>
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => setShowComments((v) => !v)}
        >
          <span className={styles.actionIcon}>💬</span>
          <span>{commentCount}</span>
        </button>
      </div>

      {/* 댓글 섹션 */}
      {showComments && (
        <CommentSection
          postId={post.id}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />
      )}
    </article>
  );
}
