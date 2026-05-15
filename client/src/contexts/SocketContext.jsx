import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// 백엔드 URL — .env의 REACT_APP_SOCKET_URL 또는 dev 기본값
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { user, authChecked } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // 로그인 상태일 때만 소켓 연결, 로그아웃 시 끊는다.
  // 쿠키(HttpOnly accessToken)는 withCredentials로 자동 전송.
  useEffect(() => {
    if (!authChecked || !user) {
      // 비로그인: 기존 연결 정리
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const sock = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = sock;

    sock.on('connect', () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));
    sock.on('connect_error', (err) => {
      // 인증 실패(UNAUTHENTICATED/INVALID_TOKEN)도 여기로 옴
      console.error('socket connect_error:', err.message);
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user, authChecked]);

  // ========================================================
  // emit wrappers — 사용처에서 직접 socket.emit 호출 X
  // ========================================================

  // 메시지 전송 (서버가 같은 방의 모두에게 message:receive emit)
  const sendMessage = useCallback(({ roomId, content, mediaUrl }) => {
    socketRef.current?.emit('message:send', {
      room_id: roomId,
      ...(content ? { content } : {}),
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
    });
  }, []);

  // 읽음 처리 (서버가 다른 멤버에게 message:read:update emit)
  const markRead = useCallback(({ roomId, lastMessageId }) => {
    socketRef.current?.emit('message:read', {
      room_id: roomId,
      last_message_id: lastMessageId,
    });
  }, []);

  // ========================================================
  // listener 등록 helper — cleanup 자동 반환
  // 사용: useEffect(() => onReceive(handler), [onReceive])
  // ========================================================

  const subscribe = useCallback((event, handler) => {
    const sock = socketRef.current;
    if (!sock) return () => {};
    sock.on(event, handler);
    return () => sock.off(event, handler);
  }, []);

  const onMessageReceive = useCallback(
    (handler) => subscribe('message:receive', handler),
    [subscribe]
  );

  const onMessageReadUpdate = useCallback(
    (handler) => subscribe('message:read:update', handler),
    [subscribe]
  );

  const onMessageDeleted = useCallback(
    (handler) => subscribe('message:deleted', handler),
    [subscribe]
  );

  const onMessageError = useCallback(
    (handler) => subscribe('message:error', handler),
    [subscribe]
  );

  const contextValue = useMemo(
    () => ({
      socket: socketRef.current,
      connected,
      sendMessage,
      markRead,
      onMessageReceive,
      onMessageReadUpdate,
      onMessageDeleted,
      onMessageError,
    }),
    [
      connected,
      sendMessage,
      markRead,
      onMessageReceive,
      onMessageReadUpdate,
      onMessageDeleted,
      onMessageError,
    ]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket은 SocketProvider 내부에서만 사용 가능합니다.');
  }
  return ctx;
}
