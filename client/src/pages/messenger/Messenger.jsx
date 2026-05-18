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

  // 방 진입 시 그 방의 unread_count 0으로
  useEffect(() => {
    if (!roomId) return;
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r))
    );
  }, [roomId]);

  // roomDisplay는 myId를 알아야 함 — rooms를 map해서 표시 이름 계산
  const roomsWithDisplay = rooms.map((room) => ({
    ...room,
    _display: roomDisplay(room, user?.id),
  }));

  const handleSelectRoom = (id) => {
    navigate(`/chats/${id}`);
  };

  const handleBackToList = () => {
    navigate('/chats');
  };

  // isMobile: CSS 미디어 쿼리 로직을 JS에서 감지
  // 실제 반응형 표시/숨김은 CSS가 담당하고, JS는 navigate만 수행
  const isRoomSelected = !!roomId;

  return (
    <div className={`${styles.page} ${isRoomSelected ? styles.pageRoomOpen : ''}`}>
      {/* 사이드바 — 채팅방 목록 */}
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <Link to="/" className={styles.backLink} aria-label="홈으로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h2 className={styles.sidebarTitle}>메신저</h2>
          <button
            className={styles.newChatBtn}
            onClick={() => setShowNewChat(true)}
            aria-label="새 채팅방 만들기"
            title="새 채팅방"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </header>

        {loading && (
          <div className={styles.stateBox}>
            <div className={styles.loadingSpinner} aria-hidden="true" />
            <span>불러오는 중...</span>
          </div>
        )}

        {error && !loading && (
          <div className={`${styles.stateBox} ${styles.errorBox}`}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={loadRooms}>다시 시도</button>
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div className={`${styles.stateBox} ${styles.emptyBox}`}>
            <div className={styles.emptyIcon} aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className={styles.emptyText}>아직 채팅방이 없습니다.</p>
            <p className={styles.emptySub}>
              <Link to="/friends" className={styles.linkHi}>친구 페이지</Link>
              에서 메시지를 보내보세요.
            </p>
          </div>
        )}

        <ul className={styles.roomList}>
          {roomsWithDisplay.map((room) => {
            const isActive = room.id === roomId;
            return (
              <li key={room.id}>
                <button
                  className={`${styles.roomItem} ${isActive ? styles.roomItemActive : ''}`}
                  onClick={() => handleSelectRoom(room.id)}
                >
                  <Avatar src={room._display.image} size={48} />
                  <div className={styles.roomInfo}>
                    <div className={styles.roomTopRow}>
                      <span className={styles.roomName}>{room._display.name}</span>
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

      {/* 메인 — 채팅룸 또는 선택 안내 */}
      <main className={styles.main}>
        {roomId ? (
          <>
            {/* 모바일: 뒤로가기 버튼 (ChatRoom 헤더 위에 주입) */}
            <div className={styles.mobileBackBar}>
              <button
                className={styles.mobileBackBtn}
                onClick={handleBackToList}
                aria-label="채팅방 목록으로"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>목록</span>
              </button>
            </div>
            <ChatRoom
              key={roomId}
              roomId={roomId}
              room={rooms.find((r) => r.id === roomId)}
              onNameChange={(id, name) =>
                setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)))
              }
            />
          </>
        ) : (
          <div className={styles.emptyMain}>
            <div className={styles.emptyMainIcon} aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className={styles.emptyMainText}>채팅방을 선택해 대화를 시작하세요</p>
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
