import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFeed } from '../api/feed';
import CreatePost from '../components/feature/CreatePost';
import PostCard from '../components/feature/PostCard';
import styles from './Home.module.css';

function SidebarAvatar({ src, name }) {
  if (src) {
    return <img src={src} alt={name} className={styles.sidebarAvatar} />;
  }
  return (
    <div className={styles.sidebarAvatarPlaceholder}>
      <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

export default function Home() {
  const { user, logout } = useAuth();

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  // 피드 불러오기
  const loadFeed = useCallback(async (cursor) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setFeedError('');
    try {
      const res = await getFeed(cursor);
      const { posts: newPosts, next_cursor } = res.data.data;
      setPosts((prev) => cursor ? [...prev, ...newPosts] : newPosts);
      setNextCursor(next_cursor);
      setHasMore(!!next_cursor);
    } catch (err) {
      setFeedError(err.response?.data?.error?.message || '피드를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setInitialLoaded(true);
      loadingRef.current = false;
    }
  }, []);

  // 최초 로딩
  useEffect(() => {
    loadFeed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 무한 스크롤 IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && nextCursor) {
          loadFeed(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, nextCursor, loadFeed]);

  // 새 게시글 피드 맨 앞에 추가 (create API는 like_count 등이 없으므로 기본값 주입)
  const handlePostCreated = useCallback((newPost) => {
    setPosts((prev) => [
      { like_count: 0, comment_count: 0, is_liked: false, ...newPost },
      ...prev,
    ]);
  }, []);

  // 게시글 삭제
  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // 게시글 수정
  const handlePostUpdated = useCallback((postId, updatedPost) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              content: updatedPost.content,
              updated_at: updatedPost.updated_at,
            }
          : p
      )
    );
  }, []);

  return (
    <div className={styles.page}>
      {/* 왼쪽 사이드바 */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarCard}>
          <div className={styles.sidebarUserRow}>
            <SidebarAvatar src={user?.profile_image} name={user?.name} />
            <div className={styles.sidebarUserInfo}>
              <span className={styles.sidebarName}>{user?.name}</span>
              <span className={styles.sidebarHandle}>@{user?.handle}</span>
            </div>
          </div>
          <nav className={styles.sidebarNav}>
            <Link to="/friends" className={styles.navItem}>
              <span className={styles.navIcon}>👥</span>
              친구 관리
            </Link>
            <Link to="/me" className={styles.navItem}>
              <span className={styles.navIcon}>✏️</span>
              프로필 수정
            </Link>
            <button
              className={`${styles.navItem} ${styles.navItemBtn}`}
              onClick={() => logout()}
            >
              <span className={styles.navIcon}>🚪</span>
              로그아웃
            </button>
          </nav>
        </div>
      </aside>

      {/* 중앙 피드 */}
      <main className={styles.feed}>
        {/* 게시글 작성 */}
        <CreatePost onPostCreated={handlePostCreated} />

        {/* 피드 에러 */}
        {feedError && (
          <div className={styles.errorBox}>
            <p>{feedError}</p>
            <button
              className={styles.retryBtn}
              onClick={() => loadFeed(null)}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 피드 목록 */}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDelete={handlePostDeleted}
            onUpdate={handlePostUpdated}
          />
        ))}

        {/* 빈 상태 */}
        {initialLoaded && !loading && posts.length === 0 && !feedError && (
          <div className={styles.emptyBox}>
            <p className={styles.emptyText}>아직 게시글이 없습니다.</p>
            <p className={styles.emptySubText}>첫 게시글을 작성하거나 친구를 추가해보세요.</p>
          </div>
        )}

        {/* 로딩 스피너 */}
        {loading && (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>불러오는 중...</span>
          </div>
        )}

        {/* 무한 스크롤 sentinel */}
        <div ref={sentinelRef} className={styles.sentinel} />

        {/* 마지막 페이지 안내 */}
        {initialLoaded && !hasMore && posts.length > 0 && !loading && (
          <p className={styles.endMsg}>모든 게시글을 불러왔습니다.</p>
        )}
      </main>
    </div>
  );
}
