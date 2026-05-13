import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Signup from './pages/auth/Signup';
import Login from './pages/auth/Login';
import Profile from './pages/auth/Profile';
import Home from './pages/Home';

// 인증 여부 확인 후 보호 라우트 처리
function PrivateRoute({ children }) {
  const { user, authChecked } = useAuth();

  if (!authChecked) {
    return <div style={{ minHeight: '100vh' }} aria-busy="true" />;
  }

  return user ? children : <Navigate to="/login" replace />;
}

// 이미 로그인된 사용자가 /login, /signup 접근 시 홈으로
function PublicOnlyRoute({ children }) {
  const { user, authChecked } = useAuth();

  if (!authChecked) {
    return <div style={{ minHeight: '100vh' }} aria-busy="true" />;
  }

  return user ? <Navigate to="/" replace /> : children;
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
        path="/"
        element={
          <PrivateRoute>
            <Home />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
