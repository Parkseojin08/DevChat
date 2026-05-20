import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const code = err.response?.data?.error?.code;

    // TOKEN_EXPIRED: 토큰이 만료된 채로 전송됨
    // UNAUTHENTICATED: maxAge 지나 쿠키가 브라우저에서 삭제됨 → 토큰 자체가 없음
    // 두 경우 모두 refresh token이 살아있으면 재발급 시도.
    // /auth/me 는 세션 확인 용도라 실패해도 재발급 시도 X (AuthContext가 직접 처리)
    if (
      err.response?.status === 401 &&
      (code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') &&
      !original._retried &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/me')
    ) {
      original._retried = true;
      try {
        await api.post('/auth/refresh');
        return api(original);
      } catch {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
