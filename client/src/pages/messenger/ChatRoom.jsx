import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { getMessages, deleteMessage, leaveRoom, uploadMessageImage } from '../../api/messenger';
import styles from './ChatRoom.module.css';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${m}`;
}

function MessageBubble({ msg, isMine, showSender, senderName, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`${styles.row} ${isMine ? styles.rowMine : styles.rowTheirs}`}>
      {!isMine && showSender && <span className={styles.senderName}>{senderName}</span>}
      <div className={styles.bubbleWrap}>
        {isMine && !msg.is_deleted && (
          <button
            className={styles.menuBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="메시지 메뉴"
          >
            ⋯
          </button>
        )}
        <div
          className={`${styles.bubble} ${isMine ? styles.bubbleMine : styles.bubbleTheirs} ${
            msg.is_deleted ? styles.bubbleDeleted : ''
          } ${msg.media_url && !msg.content && !msg.is_deleted ? styles.bubbleImageOnly : ''}`}
        >
          {msg.media_url && !msg.is_deleted && (
            <img
              src={msg.media_url}
              alt="이미지"
              className={styles.msgImage}
            />
          )}
          {msg.content && <span>{msg.content}</span>}
        </div>
        <span className={styles.bubbleTime}>{formatTime(msg.created_at)}</span>
        {menuOpen && (
          <div className={styles.menu}>
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(msg.id);
              }}
            >
              삭제
            </button>
            <button onClick={() => setMenuOpen(false)}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatRoom({ roomId, room }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    sendMessage,
    markRead,
    onMessageReceive,
    onMessageDeleted,
    onMessageError,
  } = useSocket();

  const [messages, setMessages] = useState([]); // 오래된 순서로 정렬 (위→아래)
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const listRef = useRef(null);
  const topRef = useRef(null);
  const fileInputRef = useRef(null);
  const shouldAutoScroll = useRef(true);

  // ============================================================
  // 초기 메시지 로드 (서버는 최신순 DESC 반환 → reverse하여 오름차순으로 저장)
  // ============================================================
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getMessages(roomId)
      .then((res) => {
        if (cancelled) return;
        const list = [...(res.data.data.messages || [])].reverse();
        setMessages(list);
        setNextCursor(res.data.data.next_cursor);
        shouldAutoScroll.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err.response?.data?.error?.code;
        if (code === 'NOT_MEMBER' || code === 'ROOM_NOT_FOUND') {
          navigate('/chats', { replace: true });
          return;
        }
        setError(err.response?.data?.error?.message || '메시지를 불러올 수 없습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, navigate]);

  // ============================================================
  // 자동 스크롤 (새 메시지 추가 시)
  // ============================================================
  useEffect(() => {
    if (shouldAutoScroll.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // 진입/메시지 변경 시 자동 markRead (마지막 메시지 id)
  // ============================================================
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    markRead({ roomId, lastMessageId: Number(last.id) });
  }, [messages, roomId, markRead]);

  // ============================================================
  // 실시간 수신
  // ============================================================
  useEffect(
    () =>
      onMessageReceive((msg) => {
        if (msg.room_id !== roomId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          // 사용자가 스크롤 위로 올라가있지 않을 때만 자동 스크롤
          const el = listRef.current;
          if (el) {
            shouldAutoScroll.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }
          return [...prev, msg];
        });
      }),
    [onMessageReceive, roomId]
  );

  // ============================================================
  // 삭제 수신
  // ============================================================
  useEffect(
    () =>
      onMessageDeleted((evt) => {
        if (evt.room_id !== roomId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === evt.message_id
              ? { ...m, is_deleted: true, content: '삭제된 메시지입니다' }
              : m
          )
        );
      }),
    [onMessageDeleted, roomId]
  );

  // ============================================================
  // 서버 에러
  // ============================================================
  useEffect(
    () =>
      onMessageError((evt) => {
        setError(evt.message || '메시지 처리 중 오류가 발생했습니다.');
      }),
    [onMessageError]
  );

  // ============================================================
  // 과거 메시지 로드 (위로 스크롤)
  // ============================================================
  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const el = listRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    try {
      const res = await getMessages(roomId, { cursor: nextCursor });
      const older = [...(res.data.data.messages || [])].reverse();
      setMessages((prev) => [...older, ...prev]);
      setNextCursor(res.data.data.next_cursor);
      // 스크롤 위치 유지
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
      shouldAutoScroll.current = false;
    } catch (err) {
      setError(err.response?.data?.error?.message || '과거 메시지를 불러올 수 없습니다.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, roomId]);

  useEffect(() => {
    const sentinel = topRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOlder();
      },
      { root: listRef.current, threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadOlder]);

  // ============================================================
  // 전송
  // ============================================================
  const handleSubmit = (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    sendMessage({ roomId, content });
    setInput('');
    shouldAutoScroll.current = true;
    // 전송 직후 input 활성화 (서버 ack 없으니 짧게 풀어줌)
    setTimeout(() => setSending(false), 150);
  };

  // ============================================================
  // 메시지 삭제
  // ============================================================
  const handleDelete = async (messageId) => {
    if (!window.confirm('메시지를 삭제하시겠습니까?')) return;
    try {
      await deleteMessage(messageId);
      // Socket message:deleted 이벤트가 도착하면 자동 갱신 — 즉시 반영도 OK
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, is_deleted: true, content: '삭제된 메시지입니다' } : m
        )
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || '메시지를 삭제할 수 없습니다.');
    }
  };

  // ============================================================
  // 이미지 전송
  // ============================================================
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    setError('');
    try {
      const res = await uploadMessageImage(roomId, file);
      const mediaUrl = res.data?.data?.media_url;
      if (mediaUrl) {
        sendMessage({ roomId, mediaUrl, content: null });
        shouldAutoScroll.current = true;
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || '이미지를 전송할 수 없습니다.');
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // 채팅방 나가기
  // ============================================================
  const handleLeave = async () => {
    if (!window.confirm('채팅방을 나가시겠습니까?')) return;
    try {
      await leaveRoom(roomId);
      navigate('/chats', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || '나가기에 실패했습니다.');
    }
  };

  // ============================================================
  // UI helpers
  // ============================================================
  const isGroup = room?.type === 'group';
  const counterpart =
    room?.type === 'direct' ? room.members.find((m) => m.id !== user?.id) : null;
  const title = room
    ? room.type === 'direct'
      ? counterpart?.name || '대화 상대'
      : room.name || room.members.filter((m) => m.id !== user?.id).map((m) => m.name).join(', ')
    : '...';

  const senderNameOf = (senderId) => {
    if (!room) return '';
    const m = room.members.find((m) => m.id === senderId);
    return m?.name || '알 수 없음';
  };

  return (
    <section className={styles.chatRoom}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.headerActions}>
          <button className={styles.leaveBtn} onClick={handleLeave}>
            나가기
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')}>닫기</button>
        </div>
      )}

      <div className={styles.list} ref={listRef}>
        <div ref={topRef} className={styles.topSentinel} />
        {loadingMore && <div className={styles.loadingMore}>이전 메시지 불러오는 중...</div>}

        {loading && <div className={styles.loadingCenter}>불러오는 중...</div>}

        {!loading && messages.length === 0 && (
          <div className={styles.emptyChat}>
            <p>아직 메시지가 없습니다.</p>
            <p className={styles.emptyChatSub}>첫 메시지를 보내보세요.</p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isMine = m.sender_id === user?.id;
          // group일 때 같은 사람이 연속 발신이면 이름 한 번만 표시
          const prev = idx > 0 ? messages[idx - 1] : null;
          const showSender = isGroup && !isMine && (!prev || prev.sender_id !== m.sender_id);
          return (
            <MessageBubble
              key={m.id}
              msg={m}
              isMine={isMine}
              showSender={showSender}
              senderName={senderNameOf(m.sender_id)}
              onDelete={handleDelete}
            />
          );
        })}
      </div>

      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="이미지 전송"
          title="이미지 전송"
        >
          {uploading ? '...' : '🖼'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        <input
          type="text"
          className={styles.inputField}
          placeholder="메시지를 입력하세요"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          autoFocus
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={sending || input.trim().length === 0}
        >
          전송
        </button>
      </form>
    </section>
  );
}
