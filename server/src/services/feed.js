const feedRepo = require('../repositories/feed');
const storageService = require('./storage');
const {
    NotFoundError,
    ForbiddenError,
    ConflictError
} = require('../errors/AppError');

// ======================== POSTS ========================

exports.createPost = async ({ authorId, content, mediaFiles }) => {
    const savedUrls = [];
    try {
        if (mediaFiles && mediaFiles.length > 0) {
            for (const file of mediaFiles) {
                const url = await storageService.savePostMedia(file.buffer, file.mimetype);
                savedUrls.push(url);
            }
        }

        const post = await feedRepo.insertPostWithMedia({ authorId, content, mediaUrls: savedUrls });
        return {
            id: post.id,
            author_id: post.author_id,
            content: post.content,
            media_urls: savedUrls,
            created_at: post.created_at,
            author: {
                id: post.author_id,
                handle: post.author_handle,
                name: post.author_name,
                profile_image: post.author_profile_image
            }
        };
    } catch (err) {
        // 디스크에 이미 저장된 파일 정리 (orphan 방지) — 병렬 처리
        await Promise.allSettled(savedUrls.map(url => storageService.deletePostMedia(url)));
        throw err;
    }
};

exports.updatePost = async ({ postId, userId, content }) => {
    const post = await feedRepo.findPostById(postId);
    if (!post) {
        throw new NotFoundError('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }
    if (post.author_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인이 작성한 게시글만 수정할 수 있습니다.');
    }

    const updated = await feedRepo.updatePost({ id: postId, content });
    const mediaUrls = await feedRepo.getMediaByPostId(postId);
    return {
        id: updated.id,
        author_id: updated.author_id,
        content: updated.content,
        media_urls: mediaUrls,
        created_at: updated.created_at,
        updated_at: updated.updated_at
    };
};

exports.deletePost = async ({ postId, userId }) => {
    const post = await feedRepo.findPostById(postId);
    if (!post) {
        throw new NotFoundError('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }
    if (post.author_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인이 작성한 게시글만 삭제할 수 있습니다.');
    }
    await feedRepo.deletePost(postId);
};

// ======================== FEED ========================

const formatPostRow = (row) => ({
    id: row.id,
    author: {
        id: row.author_id,
        handle: row.author_handle,
        name: row.author_name,
        profile_image: row.author_profile_image
    },
    content: row.content,
    media_urls: row.media_urls || [],
    like_count: row.like_count,
    comment_count: row.comment_count,
    is_liked: row.is_liked,
    created_at: row.created_at
});

const buildPageResult = (rows, limit) => {
    const hasNext = rows.length > limit;
    const posts = hasNext ? rows.slice(0, limit) : rows;
    const next_cursor = hasNext ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts: posts.map(formatPostRow), next_cursor };
};

exports.getFeed = async ({ userId, limit, cursor }) => {
    const rows = await feedRepo.getFeedPosts({ userId, cursor, limit });
    return buildPageResult(rows, limit);
};

exports.getUserFeed = async ({ userId, targetId, limit, cursor }) => {
    const user = await feedRepo.findUserById(targetId);
    if (!user) {
        throw new NotFoundError('USER_NOT_FOUND', '존재하지 않는 사용자입니다.');
    }
    const rows = await feedRepo.getUserPosts({ userId, targetId, cursor, limit });
    return buildPageResult(rows, limit);
};

// ======================== COMMENTS ========================

exports.createComment = async ({ postId, authorId, content, parentId }) => {
    const post = await feedRepo.findPostById(postId);
    if (!post) {
        throw new NotFoundError('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }

    let parentComment = null;
    if (parentId) {
        parentComment = await feedRepo.findCommentById(parentId);
        if (!parentComment || parentComment.post_id !== postId) {
            throw new NotFoundError('COMMENT_NOT_FOUND', '부모 댓글을 찾을 수 없습니다.');
        }
    }

    const notifType = parentId ? 'comment_reply' : 'post_comment';
    const recipientId = parentId ? parentComment.author_id : post.author_id;
    const shouldNotify = recipientId !== authorId;

    // 댓글 INSERT + 알림 INSERT를 하나의 트랜잭션으로 처리
    const comment = await feedRepo.insertCommentWithNotification({
        postId,
        authorId,
        content,
        parentId,
        notifUserId: recipientId,
        notifType,
        shouldNotify
    });

    return {
        id: comment.id,
        content: comment.content,
        parent_id: comment.parent_id,
        created_at: comment.created_at,
        author: {
            id: comment.author_id,
            handle: comment.author_handle,
            name: comment.author_name,
            profile_image: comment.author_profile_image
        }
    };
};

exports.getComments = async ({ postId }) => {
    const post = await feedRepo.findPostById(postId);
    if (!post) {
        throw new NotFoundError('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }

    const rows = await feedRepo.getCommentsByPostId(postId);
    return rows.map((row) => ({
        id: row.id,
        content: row.content,
        parent_id: row.parent_id,
        created_at: row.created_at,
        author: {
            id: row.author_id,
            handle: row.author_handle,
            name: row.author_name,
            profile_image: row.author_profile_image
        }
    }));
};

exports.deleteComment = async ({ commentId, userId }) => {
    const comment = await feedRepo.findCommentById(commentId);
    if (!comment) {
        throw new NotFoundError('COMMENT_NOT_FOUND', '댓글을 찾을 수 없습니다.');
    }
    if (comment.author_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인 댓글만 삭제할 수 있습니다.');
    }
    await feedRepo.deleteComment(commentId);
};

// ======================== LIKES ========================

exports.likePost = async ({ postId, userId }) => {
    const post = await feedRepo.findPostById(postId);
    if (!post) {
        throw new NotFoundError('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.');
    }

    // 좋아요 INSERT + 알림 INSERT를 하나의 트랜잭션으로 처리 (ON CONFLICT DO NOTHING)
    const inserted = await feedRepo.insertLikeWithNotification({
        postId, userId, postAuthorId: post.author_id
    });
    if (!inserted) {
        throw new ConflictError('ALREADY_LIKED', '이미 좋아요를 눌렀습니다.');
    }

    const likeCount = await feedRepo.getLikeCount(postId);
    return { like_count: likeCount };
};

exports.unlikePost = async ({ postId, userId }) => {
    const rowCount = await feedRepo.deleteLike({ postId, userId });
    if (rowCount === 0) {
        throw new NotFoundError('LIKE_NOT_FOUND', '좋아요 기록을 찾을 수 없습니다.');
    }

    const likeCount = await feedRepo.getLikeCount(postId);
    return { like_count: likeCount };
};