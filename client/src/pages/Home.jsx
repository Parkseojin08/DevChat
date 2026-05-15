import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getFeed, getExploreFeed } from '../api/feed';
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

  const [tab, setTab] = useState('friends'); // 'friends' | 'explore'
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  // 피드 불러오기 (탭에 따라 endpoint 분기)
  // - friends: cursor 페이지네이션
  // - explore: 단발 호출, 매 호출마다 새 무작위 결과
  const loadFeed = useCallback(async (cursor, overrideTab) => {
    if (loadingRef.current) return;
    const targetTab = overrideTab || tab;
    loadingRef.current = true;
    setLoading(true);
    setFeedError('');
    try {
      const res = targetTab === 'friends'
        ? await getFeed(cursor)
        : await getExploreFeed();
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
  }, [tab]);

  // 최초 로딩
  useEffect(() => {
    loadFeed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭 전환
  const switchTab = (newTab) => {
    if (newTab === tab || loadingRef.current) return;
    setTab(newTab);
    setPosts([]);
    setNextCursor(null);
    setHasMore(true);
    setInitialLoaded(false);
    loadFeed(null, newTab);
  };

  // 탐색 탭: 새로 섞기
  const reshuffleExplore = () => {
    if (loadingRef.current) return;
    loadFeed(null, 'explore');
  };

  // 무한 스크롤은 friends 탭에서만 활성
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (tab !== 'friends') return;

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
  }, [hasMore, loading, nextCursor, loadFeed, tab]);

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
            <Link to="/chats" className={styles.navItem}>
              <span className={styles.navIcon}>💬</span>
              메신저
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
        {/* 탭 */}
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'friends'}
            className={`${styles.tabBtn} ${tab === 'friends' ? styles.tabBtnActive : ''}`}
            onClick={() => switchTab('friends')}
          >
            친구 피드
          </button>
          <button
            role="tab"
            aria-selected={tab === 'explore'}
            className={`${styles.tabBtn} ${tab === 'explore' ? styles.tabBtnActive : ''}`}
            onClick={() => switchTab('explore')}
          >
            탐색
          </button>
        </div>

        {/* 게시글 작성은 친구 탭에서만 */}
        {tab === 'friends' && <CreatePost onPostCreated={handlePostCreated} />}

        {/* 탐색 탭: 다시 섞기 버튼 */}
        {tab === 'explore' && initialLoaded && !feedError && (
          <div className={styles.exploreToolbar}>
            <button
              className={styles.reshuffleBtn}
              onClick={reshuffleExplore}
              disabled={loading}
            >
              <span aria-hidden="true">🎲</span> 다시 섞기
            </button>
          </div>
        )}

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
            {tab === 'friends' ? (
              <>
                <p className={styles.emptyText}>아직 게시글이 없습니다.</p>
                <p className={styles.emptySubText}>첫 게시글을 작성하거나 친구를 추가해보세요.</p>
              </>
            ) : (
              <>
                <p className={styles.emptyText}>표시할 게시글이 없습니다.</p>
                <p className={styles.emptySubText}>다시 섞기를 눌러 새로운 게시글을 찾아보세요.</p>
              </>
            )}
          </div>
        )}

        {/* 로딩 스피너 */}
        {loading && (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <span className={styles.loadingText}>불러오는 중...</span>
          </div>
        )}

        {/* 무한 스크롤 sentinel (friends 탭만) */}
        {tab === 'friends' && <div ref={sentinelRef} className={styles.sentinel} />}

        {/* 마지막 페이지 안내 (friends 탭만) */}
        {tab === 'friends' && initialLoaded && !hasMore && posts.length > 0 && !loading && (
          <p className={styles.endMsg}>모든 게시글을 불러왔습니다.</p>
        )}
      </main>
    </div>
  );
}
