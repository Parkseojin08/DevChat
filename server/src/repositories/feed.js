const pool = require('../db/db');

// ======================== POSTS ========================

exports.findPostById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, author_id, content, created_at, updated_at
           FROM chatdata.posts
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

exports.updatePost = async ({ id, content }) => {
    const { rows } = await pool.query(
        `UPDATE chatdata.posts
            SET content = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, author_id, content, created_at, updated_at`,
        [content, id]
    );
    return rows[0] || null;
};

exports.deletePost = async (id) => {
    await pool.query(`DELETE FROM chatdata.posts WHERE id = $1`, [id]);
};

exports.insertPostWithMedia = async ({ authorId, content, mediaUrls }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `WITH inserted AS (
                 INSERT INTO chatdata.posts (author_id, content)
                 VALUES ($1, $2)
                 RETURNING id, author_id, content, created_at
             )
             SELECT i.id, i.content, i.created_at,
                    u.id            AS author_id,
                    u.handle        AS author_handle,
                    u.name          AS author_name,
                    u.profile_image AS author_profile_image
               FROM inserted i
               JOIN chatdata.users u ON u.id = i.author_id`,
            [authorId, content]
        );
        const post = rows[0];

        if (mediaUrls && mediaUrls.length > 0) {
            const placeholders = mediaUrls.map((_, i) => `($1, $${i + 2})`).join(', ');
            await client.query(
                `INSERT INTO chatdata.posts_media (post_id, media_url) VALUES ${placeholders}`,
                [post.id, ...mediaUrls]
            );
        }

        await client.query('COMMIT');
        return post;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.getMediaByPostId = async (postId) => {
    const { rows } = await pool.query(
        `SELECT media_url FROM chatdata.posts_media WHERE post_id = $1 ORDER BY id`,
        [postId]
    );
    return rows.map((r) => r.media_url);
};

// ======================== FEED ========================

// $1 = userId (used for is_liked check), reused across both query builders
const POST_SELECT = `
    p.id,
    p.content,
    p.created_at,
    u.id            AS author_id,
    u.handle        AS author_handle,
    u.name          AS author_name,
    u.profile_image AS author_profile_image,
    (SELECT COUNT(*)::int FROM chatdata.likes    WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*)::int FROM chatdata.comments WHERE post_id = p.id) AS comment_count,
    EXISTS (SELECT 1 FROM chatdata.likes WHERE post_id = p.id AND user_id = $1) AS is_liked,
    ARRAY(SELECT media_url FROM chatdata.posts_media WHERE post_id = p.id ORDER BY id) AS media_urls
`;

exports.getFeedPosts = async ({ userId, cursor, limit }) => {
    const params = [userId, limit + 1];
    let cursorClause = '';
    if (cursor) {
        params.push(cursor);
        cursorClause = `AND p.created_at < $${params.length}`;
    }

    const { rows } = await pool.query(
        `SELECT ${POST_SELECT}
           FROM chatdata.posts p
           JOIN chatdata.users u ON u.id = p.author_id
          WHERE (
            p.author_id = $1
            OR p.author_id IN (
              SELECT CASE
                       WHEN f.requester_id = $1 THEN f.addressee_id
                       ELSE f.requester_id
                     END
                FROM chatdata.friendships f
               WHERE (f.requester_id = $1 OR f.addressee_id = $1)
                 AND f.status = 'accepted'::chatdata.friend_status
            )
          )
          ${cursorClause}
          ORDER BY p.created_at DESC
          LIMIT $2`,
        params
    );
    return rows;
};

exports.getUserPosts = async ({ userId, targetId, cursor, limit }) => {
    // $1 = userId (is_liked), $2 = targetId, $3 = limit+1
    const params = [userId, targetId, limit + 1];
    let cursorClause = '';
    if (cursor) {
        params.push(cursor);
        cursorClause = `AND p.created_at < $${params.length}`;
    }

    const { rows } = await pool.query(
        `SELECT ${POST_SELECT}
           FROM chatdata.posts p
           JOIN chatdata.users u ON u.id = p.author_id
          WHERE p.author_id = $2
          ${cursorClause}
          ORDER BY p.created_at DESC
          LIMIT $3`,
        params
    );
    return rows;
};

// ======================== COMMENTS ========================

exports.getCommentsByPostId = async (postId) => {
    const { rows } = await pool.query(
        `SELECT c.id,
                c.content,
                c.parent_id,
                c.created_at,
                u.id            AS author_id,
                u.handle        AS author_handle,
                u.name          AS author_name,
                u.profile_image AS author_profile_image
           FROM chatdata.comments c
           JOIN chatdata.users u ON u.id = c.author_id
          WHERE c.post_id = $1
          ORDER BY c.created_at ASC`,
        [postId]
    );
    return rows;
};

exports.findCommentById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, post_id, author_id, content, parent_id, created_at
           FROM chatdata.comments
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

exports.deleteComment = async (id) => {
    await pool.query(`DELETE FROM chatdata.comments WHERE id = $1`, [id]);
};

// ======================== LIKES ========================

exports.insertLikeWithNotification = async ({ postId, userId, postAuthorId }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO chatdata.likes (post_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, user_id) DO NOTHING
             RETURNING id`,
            [postId, userId]
        );
        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return false; // 중복 좋아요
        }
        if (postAuthorId !== userId) {
            await client.query(
                `INSERT INTO chatdata.notifications (user_id, actor_id, type, target_id)
                 VALUES ($1, $2, 'post_like'::chatdata.notification_type, $3)`,
                [postAuthorId, userId, postId]
            );
        }
        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.deleteLike = async ({ postId, userId }) => {
    const result = await pool.query(
        `DELETE FROM chatdata.likes WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
    );
    return result.rowCount;
};

exports.getLikeCount = async (postId) => {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM chatdata.likes WHERE post_id = $1`,
        [postId]
    );
    return rows[0].count;
};

// ======================== NOTIFICATIONS ========================

exports.insertCommentWithNotification = async ({
    postId, authorId, content, parentId,
    notifUserId, notifType, shouldNotify
}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `WITH inserted AS (
                 INSERT INTO chatdata.comments (post_id, author_id, content, parent_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, post_id, author_id, content, parent_id, created_at
             )
             SELECT i.id,
                    i.post_id,
                    i.content,
                    i.parent_id,
                    i.created_at,
                    u.id            AS author_id,
                    u.handle        AS author_handle,
                    u.name          AS author_name,
                    u.profile_image AS author_profile_image
               FROM inserted i
               JOIN chatdata.users u ON u.id = i.author_id`,
            [postId, authorId, content, parentId || null]
        );
        const comment = rows[0];

        if (shouldNotify) {
            // post_comment: 게시글로 이동하도록 postId, comment_reply: 부모 댓글로 이동하도록 parentId
            const notifTargetId = notifType === 'post_comment' ? postId : parentId;
            await client.query(
                `INSERT INTO chatdata.notifications (user_id, actor_id, type, target_id)
                 VALUES ($1, $2, $3::chatdata.notification_type, $4)`,
                [notifUserId, authorId, notifType, notifTargetId]
            );
        }

        await client.query('COMMIT');
        return comment;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ======================== USERS ========================

exports.findUserById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id FROM chatdata.users WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};