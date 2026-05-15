import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listFriendships } from '../../api/friend';
import { createRoom } from '../../api/messenger';
import styles from './NewChatModal.module.css';

function Avatar({ src, size = 36 }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
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

export default function NewChatModal({ onClose, onRoomCreated }) {
  const navigate = useNavigate();

  const [chatType, setChatType] = useState('direct'); // 'direct' | 'group'
  const [groupName, setGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 친구 목록 로드
  useEffect(() => {
    setLoading(true);
    listFriendships('accepted')
      .then((res) => {
        const list = res.data?.data?.friendships || [];
        setFriends(list);
      })
      .catch(() => setError('친구 목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, []);

  // 채팅 타입 전환 시 선택 초기화
  const switchType = (type) => {
    setChatType(type);
    setSelected(new Set());
    setGroupName('');
    setError('');
  };

  const toggleFriend = useCallback((userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        if (chatType === 'direct') {
          // 1:1은 하나만 선택
          next.clear();
        }
        next.add(userId);
      }
      return next;
    });
  }, [chatType]);

  const handleSubmit = async () => {
    setError('');
    if (selected.size === 0) {
      setError('친구를 선택해주세요.');
      return;
    }
    if (chatType === 'direct' && selected.size !== 1) {
      setError('1:1 채팅은 한 명만 선택하세요.');
      return;
    }
    if (chatType === 'group' && selected.size < 2) {
      setError('그룹 채팅은 두 명 이상 선택해야 합니다.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: chatType,
        members: [...selected],
        ...(chatType === 'group' && groupName.trim() ? { name: groupName.trim() } : {}),
      };
      const res = await createRoom(payload);
      const room = res.data?.data?.room;
      if (room?.id) {
        onRoomCreated?.(room);
        navigate(`/chats/${room.id}`);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || '채팅방을 만들 수 없습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const canSubmit =
    !submitting &&
    ((chatType === 'direct' && selected.size === 1) ||
      (chatType === 'group' && selected.size >= 2));

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        {/* 헤더 */}
        <header className={styles.header}>
          <h2 className={styles.title}>새 채팅방</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        {/* 타입 탭 */}
        <div className={styles.typeTabs}>
          <button
            className={`${styles.typeTab} ${chatType === 'direct' ? styles.typeTabActive : ''}`}
            onClick={() => switchType('direct')}
          >
            1:1 채팅
          </button>
          <button
            className={`${styles.typeTab} ${chatType === 'group' ? styles.typeTabActive : ''}`}
            onClick={() => switchType('group')}
          >
            그룹 채팅
          </button>
        </div>

        {/* 그룹 이름 입력 */}
        {chatType === 'group' && (
          <div className={styles.groupNameWrap}>
            <input
              type="text"
              className={styles.groupNameInput}
              placeholder="그룹 이름 (선택)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>
        )}

        {/* 친구 목록 */}
        <div className={styles.friendList}>
          {loading && <p className={styles.hint}>친구 목록 불러오는 중...</p>}

          {!loading && friends.length === 0 && (
            <p className={styles.hint}>친구가 없습니다. 먼저 친구를 추가해보세요.</p>
          )}

          {friends.map((f) => {
            const u = f.user;
            const isSelected = selected.has(u.id);
            return (
              <button
                key={f.id}
                className={`${styles.friendRow} ${isSelected ? styles.friendRowSelected : ''}`}
                onClick={() => toggleFriend(u.id)}
              >
                <Avatar src={u.profile_image} size={38} />
                <div className={styles.friendInfo}>
                  <span className={styles.friendName}>{u.name}</span>
                  <span className={styles.friendHandle}>@{u.handle}</span>
                </div>
                <span className={`${styles.check} ${isSelected ? styles.checkOn : ''}`}>
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* 에러 */}
        {error && <p className={styles.error}>{error}</p>}

        {/* 하단 */}
        <footer className={styles.footer}>
          <span className={styles.selCount}>
            {selected.size > 0
              ? `${selected.size}명 선택됨`
              : chatType === 'direct'
              ? '1명 선택'
              : '2명 이상 선택'}
          </span>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? '생성 중...' : '채팅 시작'}
          </button>
        </footer>
      </div>
    </div>
  );
}
