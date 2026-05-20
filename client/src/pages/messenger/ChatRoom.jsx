import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { getMessages, deleteMessage, leaveRoom, uploadMessageImage, getMembers, inviteMembers, renameRoom } from '../../api/messenger';
import { listFriendships } from '../../api/friend';
import styles from './ChatRoom.module.css';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${m}`;
}

// 이미지 Lightbox
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className={styles.lightbox}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 크게 보기"
    >
      <button className={styles.lightboxClose} onClick={onClose} aria-label="닫기">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={src}
        alt="크게 보기"
        className={styles.lightboxImg}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function MessageBubble({ msg, isMine, showSender, senderName, onDelete, onImageClick }) {
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
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
              onClick={() => onImageClick && onImageClick(msg.media_url)}
              role="button"
              tabIndex={0}
              aria-label="이미지 크게 보기"
              onKeyDown={(e) => e.key === 'Enter' && onImageClick && onImageClick(msg.media_url)}
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

export default function ChatRoom({ roomId, room, onNameChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    sendMessage,
    markRead,
    onMessageReceive,
    onMessageDeleted,
    onMessageError,
  } = useSocket();

  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // 이름 편집
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // 멤버 패널
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');

  // 초대 모달
  const [showInvite, setShowInvite] = useState(false);
  const [invitableFriends, setInvitableFriends] = useState([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const listRef = useRef(null);
  const topRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScroll = useRef(true);

  // ============================================================
  // 초기 메시지 로드
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
    return () => { cancelled = true; };
  }, [roomId, navigate]);

  // ============================================================
  // 자동 스크롤
  // ============================================================
  useEffect(() => {
    if (shouldAutoScroll.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // markRead
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
          // socket의 msg.id는 string(`String(message.id)`), 초기 fetch의 m.id는 number이므로
          // 비교 전에 양쪽 모두 string으로 정규화 (중복 추가 방지)
          if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
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
            // evt.message_id는 String(messageId)로 발신, m.id는 fetch 결과는 number /
            // socket 수신은 string 혼재 가능 → string 비교로 통일
            String(m.id) === String(evt.message_id)
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
  // 과거 메시지 로드
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
  // textarea 자동 높이 조절
  // ============================================================
  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // ============================================================
  // 전송 (Enter: 전송, Shift+Enter: 줄바꿈)
  // ============================================================
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    sendMessage({ roomId, content });
    setInput('');
    // textarea 높이 리셋
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    shouldAutoScroll.current = true;
    setTimeout(() => setSending(false), 150);
  };

  // ============================================================
  // 메시지 삭제
  // ============================================================
  const handleDelete = async (messageId) => {
    if (!window.confirm('메시지를 삭제하시겠습니까?')) return;
    try {
      await deleteMessage(messageId);
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
  // 채팅방 이름 변경
  // ============================================================
  const startEditName = () => {
    setNameInput(title);
    setNameError('');
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameError('');
  };

  const submitNameChange = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('이름을 입력해주세요.'); return; }
    if (trimmed.length > 100) { setNameError('100자 이하로 입력해주세요.'); return; }
    if (trimmed === title) { setEditingName(false); return; }
    setNameSaving(true);
    setNameError('');
    try {
      await renameRoom(roomId, trimmed);
      onNameChange?.(roomId, trimmed);
      setEditingName(false);
    } catch (err) {
      setNameError(err.response?.data?.error?.message || '이름 변경에 실패했습니다.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') submitNameChange();
    if (e.key === 'Escape') cancelEditName();
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
  // 멤버 패널
  // ============================================================
  const openMembersPanel = async () => {
    setShowMembers(true);
    setMembersLoading(true);
    setMembersError('');
    try {
      const res = await getMembers(roomId);
      setMembers(res.data.data.members || []);
    } catch (err) {
      setMembersError(err.response?.data?.error?.message || '멤버 목록을 불러올 수 없습니다.');
    } finally {
      setMembersLoading(false);
    }
  };

  const closeMembersPanel = () => {
    setShowMembers(false);
    setShowInvite(false);
    setInviteError('');
    setSelectedInviteIds([]);
  };

  // ============================================================
  // 초대
  // ============================================================
  const openInvitePanel = async () => {
    setInviteError('');
    setSelectedInviteIds([]);
    try {
      const [membersRes, friendsRes] = await Promise.all([
        getMembers(roomId),
        listFriendships('accepted'),
      ]);
      const freshMemberIds = new Set(
        (membersRes.data.data.members || []).map((m) => m.id)
      );
      const friends = (friendsRes.data.data.friendships || [])
        .map((f) => f.user)
        .filter((u) => !freshMemberIds.has(u.id));
      setInvitableFriends(friends);
      setShowInvite(true);
    } catch (err) {
      setInviteError(err.response?.data?.error?.message || '친구 목록을 불러올 수 없습니다.');
      setShowInvite(true);
    }
  };

  const toggleInviteSelect = (userId) => {
    setSelectedInviteIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleInvite = async () => {
    if (selectedInviteIds.length === 0 || inviting) return;
    setInviting(true);
    setInviteError('');
    try {
      await inviteMembers(roomId, selectedInviteIds);
      const res = await getMembers(roomId);
      setMembers(res.data.data.members || []);
      setShowInvite(false);
      setSelectedInviteIds([]);
    } catch (err) {
      setInviteError(err.response?.data?.error?.message || '초대에 실패했습니다.');
    } finally {
      setInviting(false);
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
        {isGroup && editingName ? (
          <div className={styles.nameEditWrap}>
            <input
              className={styles.nameInput}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown}
              maxLength={100}
              autoFocus
              disabled={nameSaving}
              aria-label="채팅방 이름 편집"
            />
            {nameError && <span className={styles.nameError}>{nameError}</span>}
            <button className={styles.nameSaveBtn} onClick={submitNameChange} disabled={nameSaving}>
              {nameSaving ? '...' : '저장'}
            </button>
            <button className={styles.nameCancelBtn} onClick={cancelEditName} disabled={nameSaving}>
              취소
            </button>
          </div>
        ) : (
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>{title}</h1>
            {isGroup && (
              <button className={styles.editNameBtn} onClick={startEditName} aria-label="채팅방 이름 변경" title="이름 변경">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={styles.headerActions}>
          {isGroup && (
            <button className={styles.membersBtn} onClick={openMembersPanel}>
              멤버
            </button>
          )}
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

        {loading && (
          <div className={styles.loadingCenter}>
            <div className={styles.loadingSpinner} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className={styles.emptyChat}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e4e6eb' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>아직 메시지가 없습니다.</p>
            <p className={styles.emptyChatSub}>첫 메시지를 보내보세요.</p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isMine = m.sender_id === user?.id;
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
              onImageClick={(src) => setLightboxSrc(src)}
            />
          );
        })}
      </div>

      {/* 멤버 패널 */}
      {showMembers && (
        <div className={styles.membersOverlay} onClick={showInvite ? undefined : closeMembersPanel}>
          <div className={styles.membersPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.membersPanelHeader}>
              <span className={styles.membersPanelTitle}>채팅방 멤버</span>
              <button className={styles.membersPanelClose} onClick={closeMembersPanel} aria-label="닫기">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {membersLoading && <div className={styles.membersLoading}>불러오는 중...</div>}
            {membersError && <div className={styles.membersErr}>{membersError}</div>}

            {!membersLoading && !membersError && (
              <ul className={styles.memberList}>
                {members.map((m) => (
                  <li key={m.id} className={styles.memberItem}>
                    <div className={styles.memberAvatar}>
                      {m.profile_image
                        ? <img src={m.profile_image} alt="" />
                        : <svg viewBox="0 0 48 48" fill="none" width="36" height="36"><circle cx="24" cy="24" r="24" fill="#c5c8ce" /><circle cx="24" cy="19" r="8" fill="#fff" /><path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" /></svg>
                      }
                    </div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberHandle}>@{m.handle}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.membersPanelFooter}>
              <button className={styles.inviteOpenBtn} onClick={openInvitePanel}>
                + 멤버 초대
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 초대 모달 */}
      {showInvite && (
        <div className={styles.membersOverlay} onClick={() => setShowInvite(false)}>
          <div className={styles.membersPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.membersPanelHeader}>
              <span className={styles.membersPanelTitle}>친구 초대</span>
              <button className={styles.membersPanelClose} onClick={() => setShowInvite(false)} aria-label="닫기">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {inviteError && <div className={styles.membersErr}>{inviteError}</div>}

            {invitableFriends.length === 0 ? (
              <div className={styles.membersLoading}>초대할 수 있는 친구가 없습니다.</div>
            ) : (
              <ul className={styles.memberList}>
                {invitableFriends.map((f) => {
                  const selected = selectedInviteIds.includes(f.id);
                  return (
                    <li
                      key={f.id}
                      className={`${styles.memberItem} ${selected ? styles.memberItemSelected : ''}`}
                      onClick={() => toggleInviteSelect(f.id)}
                      role="checkbox"
                      aria-checked={selected}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === ' ' && toggleInviteSelect(f.id)}
                    >
                      <div className={styles.memberAvatar}>
                        {f.profile_image
                          ? <img src={f.profile_image} alt="" />
                          : <svg viewBox="0 0 48 48" fill="none" width="36" height="36"><circle cx="24" cy="24" r="24" fill="#c5c8ce" /><circle cx="24" cy="19" r="8" fill="#fff" /><path d="M8 42c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" /></svg>
                        }
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{f.name}</span>
                        <span className={styles.memberHandle}>@{f.handle}</span>
                      </div>
                      {selected && (
                        <span className={styles.checkmark}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={styles.membersPanelFooter}>
              <button className={styles.inviteCancelBtn} onClick={() => setShowInvite(false)}>
                취소
              </button>
              <button
                className={styles.inviteConfirmBtn}
                onClick={handleInvite}
                disabled={selectedInviteIds.length === 0 || inviting}
              >
                {inviting ? '초대 중...' : `초대하기 (${selectedInviteIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* 입력창 */}
      <form className={styles.inputBar} onSubmit={handleSubmit}>
        <button
          type="button"
          className={styles.imgBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="이미지 전송"
          title="이미지 전송"
        >
          {uploading ? (
            <div className={styles.uploadingSpinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        <textarea
          ref={textareaRef}
          className={styles.inputField}
          placeholder="메시지를 입력하세요 (Enter: 전송, Shift+Enter: 줄바꿈)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          maxLength={1000}
          rows={1}
          autoFocus
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={sending || input.trim().length === 0}
          aria-label="전송"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </section>
  );
}
