const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const usersCtrl = require('../controllers/users');

// GET /users/:id — 공개 프로필 조회
router.get('/:id', authenticate, usersCtrl.getUserProfile);

module.exports = router;
