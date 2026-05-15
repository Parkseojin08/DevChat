const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const controllers = require('../controllers/feed');

// GET /feed — 친구 피드 (본인 + accepted 친구 게시글)
router.get('/', authenticate, controllers.getFeed);

// GET /feed/explore — 탐색 피드 (본인 제외 모든 사용자, 무작위)
router.get('/explore', authenticate, controllers.getExploreFeed);

module.exports = router;
