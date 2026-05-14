const feedService = require('../services/feed');
const { ValidationError } = require('../errors/AppError');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// POST /posts
exports.createPost = async (req, res, next) => {
    try {
        const { content } = req.body || {};
        const mediaFiles = req.files || [];

        if (!isNonEmptyString(content)) {
            throw new ValidationError('MISSING_CONTENT', '본문을 입력해주세요.');
        }

        const post = await feedService.createPost({
            authorId: req.user.id,
            content: content.trim(),
            mediaFiles
        });

        return res.status(201).json({
            data: { success: true, message: '게시글이 작성되었습니다.', post }
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /posts/:id
exports.updatePost = async (req, res, next) => {
    try {
        const { content } = req.body || {};

        if (!isNonEmptyString(content)) {
            throw new ValidationError('MISSING_CONTENT', '본문을 입력해주세요.');
        }

        const post = await feedService.updatePost({
            postId: req.params.id,
            userId: req.user.id,
            content: content.trim()
        });

        return res.status(200).json({
            data: { success: true, message: '게시글이 수정되었습니다.', post }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /posts/:id
exports.deletePost = async (req, res, next) => {
    try {
        await feedService.deletePost({ postId: req.params.id, userId: req.user.id });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// GET /feed
exports.getFeed = async (req, res, next) => {
    try {
        const { cursor, limit } = req.query;
        const result = await feedService.getFeed({
            userId: req.user.id,
            cursor: cursor || null,
            limit: Math.min(parseInt(limit, 10) || 20, 50)
        });
        return res.status(200).json({ data: { success: true, ...result } });
    } catch (err) {
        next(err);
    }
};

// GET /posts/user/:userId
exports.getUserFeed = async (req, res, next) => {
    try {
        const { cursor, limit } = req.query;
        const result = await feedService.getUserFeed({
            userId: req.user.id,
            targetId: req.params.userId,
            cursor: cursor || null,
            limit: Math.min(parseInt(limit, 10) || 20, 50)
        });
        return res.status(200).json({ data: { success: true, ...result } });
    } catch (err) {
        next(err);
    }
};

// GET /posts/:postId/comments
exports.getComments = async (req, res, next) => {
    try {
        const comments = await feedService.getComments({ postId: req.params.postId });
        return res.status(200).json({ data: { success: true, comments } });
    } catch (err) {
        next(err);
    }
};

// POST /posts/:postId/comments
exports.createComment = async (req, res, next) => {
    try {
        const { content, parent_id } = req.body || {};

        if (!isNonEmptyString(content)) {
            throw new ValidationError('MISSING_CONTENT', '내용을 입력해주세요.');
        }

        const comment = await feedService.createComment({
            postId: req.params.postId,
            authorId: req.user.id,
            content: content.trim(),
            parentId: parent_id || null
        });

        return res.status(201).json({
            data: { success: true, message: '댓글이 작성되었습니다.', comment }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /comments/:id
exports.deleteComment = async (req, res, next) => {
    try {
        await feedService.deleteComment({ commentId: req.params.id, userId: req.user.id });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// POST /posts/:postId/likes
exports.likePost = async (req, res, next) => {
    try {
        const result = await feedService.likePost({
            postId: req.params.postId,
            userId: req.user.id
        });
        return res.status(201).json({
            data: { success: true, message: '좋아요를 눌렀습니다.', like_count: result.like_count }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /posts/:postId/likes
exports.unlikePost = async (req, res, next) => {
    try {
        const result = await feedService.unlikePost({
            postId: req.params.postId,
            userId: req.user.id
        });
        return res.status(200).json({
            data: { success: true, message: '좋아요를 취소하였습니다.', like_count: result.like_count }
        });
    } catch (err) {
        next(err);
    }
};
