const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const { wrapUpload, upload } = require('../middlewares/upload');
const messengerCtrl = require('../controllers/messenger');

// ============================================================
// /chat-rooms
// ============================================================

// POST   /chat-rooms          — 채팅방 생성
router.post('/', authenticate, messengerCtrl.createRoom);

// GET    /chat-rooms          — 내 채팅방 목록
router.get('/', authenticate, messengerCtrl.getRooms);

// GET    /chat-rooms/:id/messages  — 메시지 내역 조회
router.get('/:id/messages', authenticate, messengerCtrl.getMessages);

// POST   /chat-rooms/:id/messages/upload — 채팅 이미지 업로드
router.post('/:id/messages/upload', authenticate, wrapUpload(upload.single('image')), messengerCtrl.uploadMessageImage);

// POST   /chat-rooms/:id/members  — 멤버 초대
router.post('/:id/members', authenticate, messengerCtrl.inviteMembers);

// GET    /chat-rooms/:id/members  — 멤버 목록 조회
router.get('/:id/members', authenticate, messengerCtrl.getMembers);

// DELETE /chat-rooms/:id/members/me — 채팅방 나가기
// NOTE: /me 를 /:userId 보다 먼저 등록해야 'me'가 파라미터로 오해되지 않음
router.delete('/:id/members/me', authenticate, messengerCtrl.leaveRoom);

module.exports = router;
