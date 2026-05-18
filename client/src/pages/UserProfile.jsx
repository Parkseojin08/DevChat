import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../api/user';
import { getUserFeed } from '../api/feed';
import PostCard from '../components/feature/PostCard';
import styles from './UserProfile.module.css';

function Avatar({ src, name, size = 88 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={styles.avatar}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className={styles.avatarPlaceholder} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" fill="none" width={size} height={size}>
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  // 본인 프로필이면 /me로 리다이렉트
  useEffect(() => {
    if (me && me.id === userId) {
      navigate('/me', { replace: true });
    }
  }, [me, userId, navigate]);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [postsReady, setPostsReady] = useState(false);

  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  // 프로필 로드
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');
    getUserProfile(userId)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data.data.user);
      })
      .catch((err) => {
        if (cancelled) return;
        setProfileError(
          err.response?.data?.error?.message || '프로필을 불러올 수 없습니다.'
        );
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // 게시글 로드
  const loadPosts = useCallback(async (cursor) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setPostsLoading(true);
    setPostsError('');
    try {
      const res = await getUserFeed(userId, cursor);
      const { posts: newPosts, next_cursor } = res.data.data;
      setPosts((prev) => (cursor ? [...prev, ...newPosts] : newPosts));
      setNextCursor(next_cursor);
      setHasMore(!!next_cursor);
    } catch (err) {
      setPostsError(
        err.response?.data?.error?.message || '게시글을 불러올 수 없습니다.'
      );
    } finally {
      setPostsLoading(false);
      setPostsReady(true);
      loadingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    setPosts([]);
    setNextCursor(null);
    setHasMore(true);
    setPostsReady(false);
    loadPosts(null);
  }, [loadPosts]);

  // 무한 스크롤
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !postsLoading && nextCursor) {
          loadPosts(nextCursor);
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, postsLoading, nextCursor, loadPosts]);

  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handlePostUpdated = useCallback((postId, updatedPost) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, content: updatedPost.content, updated_at: updatedPost.updated_at }
          : p
      )
    );
  }, []);

  if (profileLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingCenter}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox}>
          <p>{profileError}</p>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 뒤로가기 */}
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          뒤로
        </button>

        {/* 프로필 카드 */}
        <section className={styles.profileCard}>
          <Avatar src={profile.profile_image} name={profile.name} size={88} />
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{profile.name}</h1>
            <span className={styles.profileHandle}>@{profile.handle}</span>
            {profile.bio && <p className={styles.profileBio}>{profile.bio}</p>}
          </div>
        </section>

        {/* 게시글 목록 */}
        <section className={styles.postsSection}>
          <h2 className={styles.postsTitle}>게시글</h2>

          {postsError && (
            <div className={styles.postsError}>
              <p>{postsError}</p>
              <button onClick={() => loadPosts(null)}>다시 시도</button>
            </div>
          )}

          {postsReady && posts.length === 0 && !postsLoading && !postsError && (
            <div className={styles.emptyPosts}>
              <p>아직 게시글이 없습니다.</p>
            </div>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handlePostDeleted}
              onUpdate={handlePostUpdated}
            />
          ))}

          {postsLoading && (
            <div className={styles.postsLoading}>
              <div className={styles.spinner} />
            </div>
          )}

          <div ref={sentinelRef} className={styles.sentinel} />

          {postsReady && !hasMore && posts.length > 0 && !postsLoading && (
            <p className={styles.endMsg}>모든 게시글을 불러왔습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}
