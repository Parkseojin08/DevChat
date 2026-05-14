const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const controllers = require('../controllers/feed');

// DELETE /comments/:id — 댓글 삭제
router.delete('/:id', authenticate, controllers.deleteComment);

module.exports = router;
