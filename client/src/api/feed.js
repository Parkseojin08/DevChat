import api from './axios';

export const getFeed = (cursor) =>
  api.get('/feed', { params: { ...(cursor ? { cursor } : {}) } });

export const getUserFeed = (userId, cursor) =>
  api.get(`/posts/user/${userId}`, { params: { ...(cursor ? { cursor } : {}) } });

export const createPost = (formData) =>
  api.post('/posts', formData);

export const updatePost = (id, content) =>
  api.patch(`/posts/${id}`, { content });

export const deletePost = (id) =>
  api.delete(`/posts/${id}`);

export const getComments = (postId) =>
  api.get(`/posts/${postId}/comments`);

export const createComment = (postId, content, parentId) =>
  api.post(`/posts/${postId}/comments`, {
    content,
    ...(parentId ? { parent_id: parentId } : {}),
  });

export const deleteComment = (id) =>
  api.delete(`/comments/${id}`);

export const likePost = (postId) =>
  api.post(`/posts/${postId}/likes`);

export const unlikePost = (postId) =>
  api.delete(`/posts/${postId}/likes`);
