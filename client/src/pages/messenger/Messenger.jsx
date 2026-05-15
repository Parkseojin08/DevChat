import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { getRooms } from '../../api/messenger';
import ChatRoom from './ChatRoom';
import NewChatModal from './NewChatModal';
import styles from './Messenger.module.css';

function Avatar({ src, size = 40 }) {
  if (src) {
    return <img src={src} alt="" className={styles.avatar} style={{ width: size, height: size }} />;
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

// 1:1: 상대방 / group: 방 이름 또는 멤버명 결합
function roomDisplay(room, myId) {
  if (room.type === 'direct') {
    const counterpart = room.members.find((m) => m.id !== myId);
    return {
      name: counterpart?.name || '알 수 없음',
      handle: counterpart?.handle,
      image: counterpart?.profile_image,
    };
  }
  return {
    name: room.name || room.members.filter((m) => m.id !== myId).map((m) => m.name).join(', '),
    handle: null,
    image: null,
  };
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간`;
  return `${Math.floor(diff / 86400)}일`;
}

export default function Messenger() {
  const { user } = useAuth();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { onMessageReceive, onMessageDeleted } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // 초기 로드
  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getRooms();
      setRooms(res.data.data.rooms || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || '채팅방을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // 실시간 메시지 수신 시 채팅방 목록의 last_message/unread_count 갱신
  useEffect(
    () =>
      onMessageReceive((msg) => {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== msg.room_id) return r;
            // 현재 보고 있는 방이면 unread_count 증가 안 함, 다른 방이면 +1
            const isViewingThisRoom = roomId === r.id;
            const isMine = msg.sender_id === user?.id;
            return {
              ...r,
              last_message: {
                content: msg.content,
                sender_id: msg.sender_id,
                created_at: msg.created_at,
              },
              unread_count: isViewingThisRoom || isMine
                ? r.unread_count
                : (r.unread_count || 0) + 1,
            };
          })
        );
      }),
    [onMessageReceive, roomId, user?.id]
  );

  // 메시지 삭제 수신 시 last_message 텍스트 갱신
  useEffect(
    () =>
      onMessageDeleted((evt) => {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== evt.room_id) return r;
            if (!r.last_message) return r;
            return {
              ...r,
              last_message: { ...r.last_message, content: '삭제된 메시지입니다' },
            };
          })
        );
      }),
    [onMessageDeleted]
  );

  // 방 진입 시 그 방의 unread_count 0으로 (실제 markRead는 ChatRoom이 수행)
  useEffect(() => {
    if (!roomId) return;
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r))
    );
  }, [roomId]);

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <Link to="/" className={styles.backLink} aria-label="홈으로">
            ←
          </Link>
          <h2 className={styles.sidebarTitle}>메신저</h2>
          <button
            className={styles.newChatBtn}
            onClick={() => setShowNewChat(true)}
            aria-label="새 채팅방 만들기"
            title="새 채팅방"
          >
            ✏️
          </button>
        </header>

        {loading && <div className={styles.loading}>불러오는 중...</div>}

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={loadRooms}>다시 시도</button>
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div className={styles.empty}>
            <p>아직 채팅방이 없습니다.</p>
            <p className={styles.emptySub}>
              <Link to="/friends" className={styles.linkHi}>
                친구 페이지
              </Link>
              에서 메시지를 보내보세요.
            </p>
          </div>
        )}

        <ul className={styles.roomList}>
          {rooms.map((room) => {
            const d = roomDisplay(room, user?.id);
            const isActive = room.id === roomId;
            return (
              <li key={room.id}>
                <button
                  className={`${styles.roomItem} ${isActive ? styles.roomItemActive : ''}`}
                  onClick={() => navigate(`/chats/${room.id}`)}
                >
                  <Avatar src={d.image} size={48} />
                  <div className={styles.roomInfo}>
                    <div className={styles.roomTopRow}>
                      <span className={styles.roomName}>{d.name}</span>
                      <span className={styles.roomTime}>
                        {timeAgo(room.last_message?.created_at)}
                      </span>
                    </div>
                    <div className={styles.roomBottomRow}>
                      <span className={styles.roomPreview}>
                        {room.last_message?.content || '대화를 시작해보세요'}
                      </span>
                      {room.unread_count > 0 && (
                        <span className={styles.unreadBadge}>
                          {room.unread_count > 99 ? '99+' : room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className={styles.main}>
        {roomId ? (
          <ChatRoom key={roomId} roomId={roomId} room={rooms.find((r) => r.id === roomId)} />
        ) : (
          <div className={styles.emptyMain}>
            <div className={styles.emptyMainIcon} aria-hidden="true">💬</div>
            <p>채팅방을 선택해 대화를 시작하세요</p>
            <button className={styles.emptyNewBtn} onClick={() => setShowNewChat(true)}>
              새 채팅방 만들기
            </button>
          </div>
        )}
      </main>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onRoomCreated={(room) => {
            setRooms((prev) => {
              if (prev.some((r) => r.id === room.id)) return prev;
              return [{ ...room, last_message: null, unread_count: 0 }, ...prev];
            });
          }}
        />
      )}
    </div>
  );
}
