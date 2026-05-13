import api from './axios';

export const searchUsers = (handle) =>
  api.get('/friendships/search', { params: { handle } });

export const sendFriendRequest = (addresseeId) =>
  api.post('/friendships', { addressee_id: addresseeId });

export const acceptFriendRequest = (id) =>
  api.patch(`/friendships/${id}`);

export const deleteFriendship = (id) =>
  api.delete(`/friendships/${id}`);

// direction은 optional: 'incoming' | 'outgoing' | undefined
export const listFriendships = (status, direction) =>
  api.get('/friendships', { params: { status, ...(direction ? { direction } : {}) } });
