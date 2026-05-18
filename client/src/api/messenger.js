import api from './axios';

// ============================================================
// 채팅방
// ============================================================

/**
 * 채팅방 생성.
 * - direct: members 1명
 * - group: members 2명 이상 + name 권장
 * @param {{ type: 'direct'|'group', name?: string, members: string[] }} payload
 */
export const createRoom = (payload) => api.post('/chat-rooms', payload);

// 내 채팅방 목록 (최근 메시지·미읽음 카운트 포함)
export const getRooms = () => api.get('/chat-rooms');

/**
 * 채팅방 메시지 내역 조회 (cursor 페이지네이션).
 * @param {string} roomId
 * @param {{ cursor?: string, limit?: number }} options
 */
export const getMessages = (roomId, { cursor, limit } = {}) =>
  api.get(`/chat-rooms/${roomId}/messages`, {
    params: {
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit } : {}),
    },
  });

// ============================================================
// 멤버
// ============================================================

// 그룹 채팅방 이름 변경
export const renameRoom = (roomId, name) =>
  api.patch(`/chat-rooms/${roomId}`, { name });

// 그룹 채팅방에 멤버 초대
export const inviteMembers = (roomId, userIds) =>
  api.post(`/chat-rooms/${roomId}/members`, { user_ids: userIds });

// 채팅방 멤버 목록
export const getMembers = (roomId) =>
  api.get(`/chat-rooms/${roomId}/members`);

// 본인이 채팅방 나가기
export const leaveRoom = (roomId) =>
  api.delete(`/chat-rooms/${roomId}/members/me`);

// ============================================================
// 메시지
// ============================================================

// 본인 메시지 삭제 (soft delete) — Socket으로 다른 멤버에게 message:deleted emit
export const deleteMessage = (messageId) =>
  api.delete(`/messages/${messageId}`);

// 채팅방 이미지 업로드 → media_url 반환
export const uploadMessageImage = (roomId, file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post(`/chat-rooms/${roomId}/messages/upload`, fd);
};
