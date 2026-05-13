import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getMe, logout as logoutApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // null  = 아직 확인 중
  // false = 비로그인 확정
  const [authChecked, setAuthChecked] = useState(false);

  // 앱 최초 마운트 시 세션 복원
  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data.data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // 쿠키 클리어 실패해도 클라이언트 상태는 초기화
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const contextValue = useMemo(
    () => ({ user, authChecked, login, logout, updateUser }),
    [user, authChecked, login, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용 가능합니다.');
  return ctx;
}
