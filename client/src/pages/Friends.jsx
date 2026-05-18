import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendship,
  listFriendships,
} from '../api/friend';
import { createRoom } from '../api/messenger';
import styles from './Friends.module.css';

// 탭 정의
const TABS = [
  { key: 'accepted', label: '친구 목록' },
  { key: 'incoming', label: '받은 신청' },
  { key: 'outgoing', label: '보낸 신청' },
];

// 프로필 이미지 없을 때 사용하는 placeholder SVG
function AvatarPlaceholder() {
  return (
    <div className={styles.avatarPlaceholder}>
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="24" fill="#c5c8ce" />
        <circle cx="24" cy="19" r="8" fill="#fff" />
        <path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" />
      </svg>
    </div>
  );
}

// 개별 친구/신청 row 컴포넌트
function FriendRow({ item, tabKey, onAction, onStartChat }) {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');

  const handleAction = async (type) => {
    setBusy(true);
    setRowError('');
    try {
      await onAction(type, item.id);
    } catch (err) {
      const msg = err.response?.data?.error?.message || '처리 중 오류가 발생했습니다.';
      setRowError(msg);
    } finally {
      setBusy(false);
    }
  };

  const { user } = item;

  return (
    <>
      <div className={styles.friendRow}>
        <Link to={`/users/${user.id}`} className={styles.avatarLink}>
          {user.profile_image ? (
            <img src={user.profile_image} alt="" className={styles.avatar} />
          ) : (
            <AvatarPlaceholder />
          )}
        </Link>
        <Link to={`/users/${user.id}`} className={styles.userInfoLink}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userHandle}>@{user.handle}</span>
          </div>
        </Link>
        <div className={styles.btnGroup}>
          {tabKey === 'accepted' && (
            <>
              <button
                className={styles.btnPrimary}
                disabled={busy}
                onClick={() => onStartChat(user.id)}
              >
                메시지
              </button>
              <button
                className={styles.btnSecondary}
                disabled={busy}
                onClick={() => handleAction('delete')}
              >
                {busy ? '처리 중...' : '친구 끊기'}
              </button>
            </>
          )}
          {tabKey === 'incoming' && (
            <>
              <button
                className={styles.btnPrimary}
                disabled={busy}
                onClick={() => handleAction('accept')}
              >
                {busy ? '처리 중...' : '수락'}
              </button>
              <button
                className={styles.btnSecondary}
                disabled={busy}
                onClick={() => handleAction('delete')}
              >
                {busy ? '처리 중...' : '거절'}
              </button>
            </>
          )}
          {tabKey === 'outgoing' && (
            <button
              className={styles.btnSecondary}
              disabled={busy}
              onClick={() => handleAction('delete')}
            >
              {busy ? '처리 중...' : '취소'}
            </button>
          )}
        </div>
      </div>
      {rowError && <p className={styles.rowError}>{rowError}</p>}
    </>
  );
}

// 검색 결과 row 컴포넌트
function SearchResultRow({ user }) {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setBusy(true);
    setRowError('');
    try {
      await sendFriendRequest(user.id);
      setSent(true);
    } catch (err) {
      const msg = err.response?.data?.error?.message || '친구 신청 중 오류가 발생했습니다.';
      setRowError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.friendRow}>
        <Link to={`/users/${user.id}`} className={styles.avatarLink}>
          {user.profile_image ? (
            <img src={user.profile_image} alt="" className={styles.avatar} />
          ) : (
            <AvatarPlaceholder />
          )}
        </Link>
        <Link to={`/users/${user.id}`} className={styles.userInfoLink}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userHandle}>@{user.handle}</span>
          </div>
        </Link>
        <div className={styles.btnGroup}>
          <button
            className={styles.btnPrimary}
            disabled={busy || sent}
            onClick={handleSend}
          >
            {busy ? '처리 중...' : sent ? '신청 완료' : '친구 신청'}
          </button>
        </div>
      </div>
      {rowError && <p className={styles.rowError}>{rowError}</p>}
    </>
  );
}

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 탭 상태
  const [activeTab, setActiveTab] = useState('accepted');

  // 친구 목록 상태
  const [friendships, setFriendships] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  // 검색 상태
  const [handleInput, setHandleInput] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = 미검색
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // 탭별 목록 fetch
  const fetchList = useCallback(async (tab) => {
    setListLoading(true);
    setListError('');
    try {
      let res;
      if (tab === 'accepted') {
        res = await listFriendships('accepted');
      } else {
        res = await listFriendships('pending', tab); // 'incoming' | 'outgoing'
      }
      setFriendships(res.data?.data?.friendships || []);
    } catch (err) {
      const msg = err.response?.data?.error?.message || '목록을 불러오는 중 오류가 발생했습니다.';
      setListError(msg);
    } finally {
      setListLoading(false);
    }
  }, []);

  // 탭 변경 시 목록 다시 로드
  useEffect(() => {
    fetchList(activeTab);
  }, [activeTab, fetchList]);

  const handleTabChange = (key) => {
    if (key === activeTab) return;
    setActiveTab(key);
    setFriendships([]);
  };

  // 친구 row 액션 처리
  const handleAction = async (type, friendshipId) => {
    if (type === 'accept') {
      await acceptFriendRequest(friendshipId);
    } else {
      await deleteFriendship(friendshipId);
    }
    // 성공 후 목록 갱신
    await fetchList(activeTab);
  };

  // 메시지 보내기 — 1:1 채팅방 생성/조회 후 이동
  const handleStartChat = async (targetUserId) => {
    try {
      const res = await createRoom({ type: 'direct', members: [targetUserId] });
      const room = res.data?.data?.room;
      if (room?.id) navigate(`/chats/${room.id}`);
    } catch (err) {
      const msg = err.response?.data?.error?.message || '채팅방을 시작할 수 없습니다.';
      setListError(msg);
    }
  };

  // 검색 실행
  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = handleInput.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await searchUsers(trimmed);
      const users = res.data?.data?.users || [];
      // 본인은 검색 결과에서 제외 (자기 자신에게 친구 신청 불가)
      const filtered = user?.id ? users.filter((u) => u.id !== user.id) : users;
      setSearchResults(filtered);
    } catch (err) {
      const msg = err.response?.data?.error?.message || '검색 중 오류가 발생했습니다.';
      setSearchError(msg);
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInputChange = (e) => {
    setHandleInput(e.target.value);
    if (!e.target.value.trim()) {
      setSearchResults(null);
      setSearchError('');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 헤더 */}
        <div className={styles.header}>
          <Link to="/" className={styles.backLink} aria-label="홈으로">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            홈으로
          </Link>
          <h1 className={styles.pageTitle}>친구 관리</h1>
        </div>

        {/* 검색 카드 */}
        <div className={styles.card}>
          <p className={styles.searchTitle}>사용자 검색</p>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="@handle 로 검색"
              value={handleInput}
              onChange={handleSearchInputChange}
            />
            <button
              type="submit"
              className={styles.searchBtn}
              disabled={searchLoading}
            >
              {searchLoading ? '검색 중...' : '검색'}
            </button>
          </form>

          {searchError && (
            <p className={`${styles.globalError} ${styles.searchError}`} role="alert">
              {searchError}
            </p>
          )}

          {searchResults !== null && (
            <div className={styles.searchResults}>
              {searchResults.length === 0 ? (
                <p className={styles.searchEmpty}>검색 결과가 없습니다.</p>
              ) : (
                searchResults.map((u) => (
                  <SearchResultRow key={u.id} user={u} />
                ))
              )}
            </div>
          )}
        </div>

        {/* 탭 카드 */}
        <div className={styles.card}>
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={
                  activeTab === tab.key
                    ? `${styles.tabBtn} ${styles.tabBtnActive}`
                    : styles.tabBtn
                }
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>
            {listError && (
              <p className={styles.globalError} role="alert">{listError}</p>
            )}

            {listLoading && (
              <div className={styles.loadingMsg}>
                <div className={styles.loadingSpinner} aria-hidden="true" />
                <span>불러오는 중...</span>
              </div>
            )}

            {!listLoading && !listError && friendships.length === 0 && (
              <p className={styles.emptyMsg}>
                {activeTab === 'accepted' && '친구가 없습니다.'}
                {activeTab === 'incoming' && '받은 친구 신청이 없습니다.'}
                {activeTab === 'outgoing' && '보낸 친구 신청이 없습니다.'}
              </p>
            )}

            {!listLoading &&
              friendships.map((item) => (
                <FriendRow
                  key={item.id}
                  item={item}
                  tabKey={activeTab}
                  onAction={handleAction}
                  onStartChat={handleStartChat}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
