import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { getRooms } from '../api/messenger';

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const { user } = useAuth();
  const { onMessageReceive } = useSocket();
  const location = useLocation();
  const [totalUnread, setTotalUnread] = useState(0);

  // 현재 경로를 ref로 관리 — socket 핸들러 클로저 안에서 stale 방지
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const refresh = useCallback(async () => {
    if (!user) {
      setTotalUnread(0);
      return;
    }
    try {
      const res = await getRooms();
      const rooms = res.data.data.rooms || [];
      const total = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);
      setTotalUnread(total);
    } catch {
      // 조용히 실패 — 배지 숫자가 없어도 앱 동작에 영향 없음
    }
  }, [user]);

  // 로그인/로그아웃 시 초기화 + 재조회
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 채팅 페이지 진입 시 서버에서 정확한 값으로 리셋
  useEffect(() => {
    if (location.pathname.startsWith('/chats')) {
      refresh();
    }
  }, [location.pathname, refresh]);

  // 실시간 수신: 본인 메시지 제외, 채팅 페이지 밖에서만 카운트
  useEffect(() => {
    return onMessageReceive((msg) => {
      if (msg.sender_id === user?.id) return;
      if (pathnameRef.current.startsWith('/chats')) return;
      setTotalUnread((prev) => prev + 1);
    });
  }, [onMessageReceive, user?.id]);

  return (
    <UnreadContext.Provider value={{ totalUnread, refresh }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread는 UnreadProvider 내부에서만 사용 가능합니다.');
  return ctx;
}
