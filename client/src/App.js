import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { UnreadProvider, useUnread } from './contexts/UnreadContext';
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import Profile from './pages/auth/Profile';
import Home from './pages/Home';
import Friends from './pages/Friends';
import Messenger from './pages/messenger/Messenger';
import UserProfile from './pages/UserProfile';
import styles from './App.module.css';

// 인증 여부 확인 후 보호 라우트 처리
function PrivateRoute({ children }) {
  const { user, authChecked } = useAuth();

  if (!authChecked) {
    return <div className={styles.authLoadingScreen} aria-busy="true" />;
  }

  return user ? children : <Navigate to="/login" replace />;
}

// 이미 로그인된 사용자가 /login, /signup 접근 시 홈으로
function PublicOnlyRoute({ children }) {
  const { user, authChecked } = useAuth();

  if (!authChecked) {
    return <div className={styles.authLoadingScreen} aria-busy="true" />;
  }

  return user ? <Navigate to="/" replace /> : children;
}

// 상단 고정 헤더 — 로그인 상태, 공개 페이지 제외
function TopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const hiddenPaths = ['/login', '/signup'];
  if (!user || hiddenPaths.includes(location.pathname)) return null;

  return (
    <header className={styles.topBar} role="banner">
      <div className={styles.topBarInner}>
        <span className={styles.topBarLogo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          DevChat
        </span>
      </div>
    </header>
  );
}

// 모바일 하단 내비게이션 — 인증된 사용자에게만, 공개 페이지에선 숨김
function BottomNav() {
  const { user } = useAuth();
  const { totalUnread } = useUnread();
  const location = useLocation();

  // 로그인/회원가입 페이지에선 표시 안 함
  const hiddenPaths = ['/login', '/signup'];
  if (!user || hiddenPaths.includes(location.pathname)) return null;

  return (
    <nav className={styles.bottomNav} aria-label="하단 내비게이션">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`
        }
        aria-label="홈"
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className={styles.navLabel}>홈</span>
      </NavLink>

      <NavLink
        to="/friends"
        className={({ isActive }) =>
          `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`
        }
        aria-label="친구"
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className={styles.navLabel}>친구</span>
      </NavLink>

      <NavLink
        to="/chats"
        className={({ isActive }) =>
          `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`
        }
        aria-label="채팅"
      >
        <span className={styles.navIconWrap}>
          <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {totalUnread > 0 && (
            <span className={styles.navBadge} aria-label={`안 읽은 메시지 ${totalUnread}개`}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>
        <span className={styles.navLabel}>채팅</span>
      </NavLink>

      <NavLink
        to="/me"
        className={({ isActive }) =>
          `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`
        }
        aria-label="프로필"
      >
        <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className={styles.navLabel}>프로필</span>
      </NavLink>
    </nav>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/me"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <PrivateRoute>
            <Friends />
          </PrivateRoute>
        }
      />
      <Route
        path="/chats"
        element={
          <PrivateRoute>
            <Messenger />
          </PrivateRoute>
        }
      />
      <Route
        path="/chats/:roomId"
        element={
          <PrivateRoute>
            <Messenger />
          </PrivateRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />
      <Route
        path="/users/:userId"
        element={
          <PrivateRoute>
            <UserProfile />
          </PrivateRoute>
        }
      />
      {/* 정의되지 않은 경로 → 홈으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <UnreadProvider>
            <TopBar />
            <AppRoutes />
            <BottomNav />
          </UnreadProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
