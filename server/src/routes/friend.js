const express = require('express');
const routes = express.Router();
const controllers = require('../controllers/friend');
const { authenticate } = require('../middlewares/authenticate');

// 사용자 검색 (handle로)
routes.get('/search', authenticate, controllers.searchUsers);

// 친구 신청
routes.post('/', authenticate, controllers.sendRequest);

// 친구 수락 (pending → accepted)
routes.patch('/:id', authenticate, controllers.acceptRequest);

// 친구 관계 삭제 (거절 / 신청 취소 / 친구 끊기)
routes.delete('/:id', authenticate, controllers.deleteRelation);

// 친구 목록 조회
routes.get('/', authenticate, controllers.listFriendships);

module.exports = routes;
