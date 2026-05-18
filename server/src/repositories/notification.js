const pool = require('../db/db');

/**
 * 알림 목록 조회 (커서 기반 페이지네이션, 최신순).
 *
 * 커서 규칙: created_at < cursor (ISO 문자열). 같은 timestamp가 여러 개일 수 있으므로
 * id를 tiebreaker로 사용해 (created_at, id) 튜플 비교를 한다.
 *
 * @param {object} params
 * @param {string} params.userId   알림 수신자
 * @param {string|null} params.cursor   "{ISO}|{id}" 형식 또는 null
 * @param {number} params.limit   페이지 크기 (서비스에서 +1 처리)
 * @param {boolean} params.unread   true면 is_read=false만
 */
exports.listNotifications = async ({ userId, cursor, limit, unread }) => {
    const params = [userId, limit];
    let cursorClause = '';
    if (cursor) {
        params.push(cursor.createdAt, cursor.id);
        cursorClause = `AND (n.created_at, n.id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`;
    }
    let unreadClause = '';
    if (unread) {
        unreadClause = `AND n.is_read = FALSE`;
    }

    const { rows } = await pool.query(
        `SELECT n.id,
                n.type,
                n.target_id,
                n.is_read,
                n.created_at,
                u.id            AS actor_id,
                u.handle        AS actor_handle,
                u.name          AS actor_name,
                u.profile_image AS actor_profile_image
           FROM chatdata.notifications n
           LEFT JOIN chatdata.users u ON u.id = n.actor_id
          WHERE n.user_id = $1
            ${unreadClause}
            ${cursorClause}
          ORDER BY n.created_at DESC, n.id DESC
          LIMIT $2`,
        params
    );
    return rows;
};

/**
 * 본인의 미읽음 알림 개수.
 */
exports.countUnread = async (userId) => {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count
           FROM chatdata.notifications
          WHERE user_id = $1
            AND is_read = FALSE`,
        [userId]
    );
    return rows[0].count;
};

/**
 * id로 알림 조회. 권한·존재 체크용. 없으면 null.
 */
exports.findById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, user_id, actor_id, type, target_id, is_read, created_at
           FROM chatdata.notifications
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

/**
 * 개별 알림 읽음 처리. is_read=true로 갱신.
 */
exports.markAsRead = async (id) => {
    await pool.query(
        `UPDATE chatdata.notifications
            SET is_read = TRUE
          WHERE id = $1`,
        [id]
    );
};

/**
 * 본인의 모든 미읽음 알림을 일괄 읽음 처리.
 */
exports.markAllAsRead = async (userId) => {
    await pool.query(
        `UPDATE chatdata.notifications
            SET is_read = TRUE
          WHERE user_id = $1
            AND is_read = FALSE`,
        [userId]
    );
};

/**
 * 알림 삭제.
 */
exports.deleteById = async (id) => {
    await pool.query(
        `DELETE FROM chatdata.notifications WHERE id = $1`,
        [id]
    );
};
