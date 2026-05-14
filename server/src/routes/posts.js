const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const { wrapUpload, upload } = require('../middlewares/upload');
const controllers = require('../controllers/feed');

// POST   /posts            — 게시글 작성
// PATCH  /posts/:id        — 게시글 수정
// DELETE /posts/:id        — 게시글 삭제
// GET    /posts/user/:userId — 유저 피드
// GET    /posts/:postId/comments — 댓글 목록 조회
// POST   /posts/:postId/comments — 댓글 작성
// POST   /posts/:postId/likes    — 좋아요
// DELETE /posts/:postId/likes    — 좋아요 취소

router.post('/', authenticate, wrapUpload(upload.array('media', 5)), controllers.createPost);

// /user/:userId는 /:id 보다 먼저 정의해야 라우터 충돌 방지
router.get('/user/:userId', authenticate, controllers.getUserFeed);

router.patch('/:id', authenticate, controllers.updatePost);
router.delete('/:id', authenticate, controllers.deletePost);

router.get('/:postId/comments', authenticate, controllers.getComments);
router.post('/:postId/comments', authenticate, controllers.createComment);

router.post('/:postId/likes', authenticate, controllers.likePost);
router.delete('/:postId/likes', authenticate, controllers.unlikePost);

module.exports = router;
