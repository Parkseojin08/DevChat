const express = require('express');
const routes = express.Router();
const controllers = require('../controllers/notification');
const { authenticate } = require('../middlewares/authenticate');

// 알림 목록 조회
routes.get('/', authenticate, controllers.listNotifications);

// 일괄 읽음 처리 — 반드시 :id 보다 먼저 등록 (정적 경로 우선)
routes.patch('/read-all', authenticate, controllers.markAllAsRead);

// 개별 알림 읽음 처리
routes.patch('/:id', authenticate, controllers.markAsRead);

// 알림 삭제
routes.delete('/:id', authenticate, controllers.deleteNotification);

module.exports = routes;
