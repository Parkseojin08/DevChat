import api from './axios';

// FormData를 그대로 전달 — axios가 Content-Type: multipart/form-data 자동 설정
export const signUp = (formData) => api.post('/auth/signup', formData);

// 회원가입 1단계 — 이메일 인증 코드 발송 (multipart/form-data, profile_image 동반 가능)
export const sendEmailCode = (formData) => api.post('/auth/email/send-code', formData);

// 회원가입 2단계 — 인증 코드 검증 + 계정 생성 + 자동 로그인
export const verifyEmailCode = (data) => api.post('/auth/email/verify', data);

export const login = (data) => api.post('/auth/login', data);

export const logout = () => api.post('/auth/logout');

export const refresh = () => api.post('/auth/refresh');

export const getMe = () => api.get('/auth/me');

// FormData를 그대로 전달 — Content-Type 강제 설정 금지
export const updateProfile = (formData) => api.patch('/auth/me', formData);

// 회원 탈퇴 — 본인 계정 영구 삭제 (CASCADE로 게시글·친구관계 등 모두 삭제)
// 백엔드는 password 재확인을 요구한다.
export const deleteAccount = (password) =>
  api.delete('/auth/me', { data: { password } });
