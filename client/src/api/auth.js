import api from './axios';

// FormData를 그대로 전달 — axios가 Content-Type: multipart/form-data 자동 설정
export const signUp = (formData) => api.post('/auth/signup', formData);

export const login = (data) => api.post('/auth/login', data);

export const logout = () => api.post('/auth/logout');

export const refresh = () => api.post('/auth/refresh');

export const getMe = () => api.get('/auth/me');

// FormData를 그대로 전달 — Content-Type 강제 설정 금지
export const updateProfile = (formData) => api.patch('/auth/me', formData);
