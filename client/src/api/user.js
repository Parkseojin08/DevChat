import api from './axios';

// 특정 사용자 공개 프로필 조회
export const getUserProfile = (userId) => api.get(`/users/${userId}`);
