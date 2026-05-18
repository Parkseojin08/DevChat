const pool = require('../db/db');

/**
 * handle ILIKE 부분 일치로 사용자 검색. 본인 제외.
 */
exports.searchUsersByHandle = async (handle, selfId) => {
    const { rows } = await pool.query(
        `SELECT id, handle, name, profile_image
           FROM chatdata.users
          WHERE handle ILIKE $1
            AND id <> $2
          ORDER BY handle
          LIMIT 20`,
        [`%${handle}%`, selfId]
    );
    return rows;
};

/**
 * friendship row를 id로 조회. 없으면 null.
 */
exports.findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, requester_id, addressee_id, status, created_at, updated_at
           FROM chatdata.friendships
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

/**
 * 두 사용자 사이에 이미 friendship row가 존재하는지 확인 (방향 무관).
 * accepted / pending 구분 없이 하나라도 존재하면 반환.
 */
exports.findRelation = async (userAId, userBId) => {
    const { rows } = await pool.query(
        `SELECT id, requester_id, addressee_id, status
           FROM chatdata.friendships
          WHERE (requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1)
          LIMIT 1`,
        [userAId, userBId]
    );
    return rows[0] || null;
};

/**
 * pending 상태의 friendship row 삽입 + friend_request 알림 INSERT를 트랜잭션으로 처리.
 * 생성된 friendship row 반환.
 */
exports.insertPendingWithNotification = async ({ requesterId, addresseeId }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `INSERT INTO chatdata.friendships (requester_id, addressee_id, status)
             VALUES ($1, $2, 'pending'::chatdata.friend_status)
             RETURNING id, requester_id, addressee_id, status, created_at`,
            [requesterId, addresseeId]
        );
        const friendship = rows[0];

        // 수신자(addressee)에게 친구 신청 알림. target_id = friendship.id
        await client.query(
            `INSERT INTO chatdata.notifications (user_id, actor_id, type, target_id)
             VALUES ($1, $2, 'friend_request'::chatdata.notification_type, $3)`,
            [addresseeId, requesterId, String(friendship.id)]
        );

        await client.query('COMMIT');
        return friendship;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * pending → accepted 상태 업데이트 + friend_accepted 알림 INSERT를 트랜잭션으로 처리.
 * 수락 성공 시 갱신된 friendship row, 이미 accepted 등으로 갱신 실패 시 null 반환.
 */
exports.acceptByIdWithNotification = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `UPDATE chatdata.friendships
                SET status = 'accepted'::chatdata.friend_status,
                    updated_at = NOW()
              WHERE id = $1
                AND status = 'pending'::chatdata.friend_status
              RETURNING id, requester_id, addressee_id, status, updated_at`,
            [id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }
        const friendship = rows[0];

        // 신청자(requester)에게 수락 알림. actor = addressee. target_id = friendship.id
        await client.query(
            `INSERT INTO chatdata.notifications (user_id, actor_id, type, target_id)
             VALUES ($1, $2, 'friend_accepted'::chatdata.notification_type, $3)`,
            [friendship.requester_id, friendship.addressee_id, String(friendship.id)]
        );

        await client.query('COMMIT');
        return friendship;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * friendship row 삭제.
 */
exports.deleteById = async (id) => {
    await pool.query(
        `DELETE FROM chatdata.friendships WHERE id = $1`,
        [id]
    );
};

/**
 * 내가 포함된 accepted 관계 전체 조회. 상대방 정보 JOIN.
 */
exports.listAccepted = async (userId) => {
    const { rows } = await pool.query(
        `SELECT f.id,
                f.status,
                f.created_at,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.id
                    ELSE u_r.id
                END AS user_id,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.handle
                    ELSE u_r.handle
                END AS user_handle,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.name
                    ELSE u_r.name
                END AS user_name,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.profile_image
                    ELSE u_r.profile_image
                END AS user_profile_image
           FROM chatdata.friendships f
           JOIN chatdata.users u_r ON u_r.id = f.requester_id
           JOIN chatdata.users u_a ON u_a.id = f.addressee_id
          WHERE (f.requester_id = $1 OR f.addressee_id = $1)
            AND f.status = 'accepted'::chatdata.friend_status
          ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
};

/**
 * direction=incoming: 내가 addressee인 pending 목록.
 */
exports.listPendingIncoming = async (userId) => {
    const { rows } = await pool.query(
        `SELECT f.id,
                f.status,
                f.created_at,
                u_r.id             AS user_id,
                u_r.handle         AS user_handle,
                u_r.name           AS user_name,
                u_r.profile_image  AS user_profile_image
           FROM chatdata.friendships f
           JOIN chatdata.users u_r ON u_r.id = f.requester_id
          WHERE f.addressee_id = $1
            AND f.status = 'pending'::chatdata.friend_status
          ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
};

/**
 * direction=outgoing: 내가 requester인 pending 목록.
 */
exports.listPendingOutgoing = async (userId) => {
    const { rows } = await pool.query(
        `SELECT f.id,
                f.status,
                f.created_at,
                u_a.id             AS user_id,
                u_a.handle         AS user_handle,
                u_a.name           AS user_name,
                u_a.profile_image  AS user_profile_image
           FROM chatdata.friendships f
           JOIN chatdata.users u_a ON u_a.id = f.addressee_id
          WHERE f.requester_id = $1
            AND f.status = 'pending'::chatdata.friend_status
          ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
};

/**
 * direction 미지정: incoming + outgoing 합산 (created_at DESC).
 */
exports.listPendingBoth = async (userId) => {
    const { rows } = await pool.query(
        `SELECT f.id,
                f.status,
                f.created_at,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.id
                    ELSE u_r.id
                END AS user_id,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.handle
                    ELSE u_r.handle
                END AS user_handle,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.name
                    ELSE u_r.name
                END AS user_name,
                CASE
                    WHEN f.requester_id = $1 THEN u_a.profile_image
                    ELSE u_r.profile_image
                END AS user_profile_image
           FROM chatdata.friendships f
           JOIN chatdata.users u_r ON u_r.id = f.requester_id
           JOIN chatdata.users u_a ON u_a.id = f.addressee_id
          WHERE (f.requester_id = $1 OR f.addressee_id = $1)
            AND f.status = 'pending'::chatdata.friend_status
          ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
};