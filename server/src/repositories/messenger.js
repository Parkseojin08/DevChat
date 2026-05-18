const pool = require('../db/db');

// ============================================================
// chat_rooms
// ============================================================

/**
 * direct_key로 기존 1:1 채팅방 조회. 없으면 null.
 */
exports.findRoomByDirectKey = async (directKey) => {
    const { rows } = await pool.query(
        `SELECT id, type, name, direct_key, created_at, updated_at
           FROM chatdata.chat_rooms
          WHERE direct_key = $1`,
        [directKey]
    );
    return rows[0] || null;
};

/**
 * 채팅방 id로 채팅방 조회. 없으면 null.
 */
exports.findRoomById = async (roomId) => {
    const { rows } = await pool.query(
        `SELECT id, type, name, direct_key, created_at, updated_at
           FROM chatdata.chat_rooms
          WHERE id = $1`,
        [roomId]
    );
    return rows[0] || null;
};

/**
 * 새 채팅방 insert. RETURNING 포함.
 */
exports.insertRoom = async ({ type, name, directKey }, client) => {
    const db = client || pool;
    const { rows } = await db.query(
        `INSERT INTO chatdata.chat_rooms (type, name, direct_key)
         VALUES ($1::chatdata.room_type_status, $2, $3)
         RETURNING id, type, name, direct_key, created_at, updated_at`,
        [type, name || null, directKey || null]
    );
    return rows[0];
};

/**
 * 채팅방 멤버 일괄 insert (배열). RETURNING id, user_id, joined_at.
 */
/**
 * 그룹 채팅방 이름 변경. updated_at 갱신 포함.
 */
exports.updateRoomName = async (roomId, name) => {
    const { rows } = await pool.query(
        `UPDATE chatdata.chat_rooms
            SET name = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING id, name`,
        [roomId, name]
    );
    return rows[0] || null;
};

exports.insertRoomMembers = async (roomId, userIds, client) => {
    const db = client || pool;
    // 각 userId에 대해 개별 insert 수행 (bulk용 VALUES 생성)
    if (userIds.length === 0) return [];
    const placeholders = userIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    const { rows } = await db.query(
        `INSERT INTO chatdata.room_members (room_id, user_id)
         VALUES ${placeholders}
         RETURNING id, room_id, user_id, joined_at`,
        [roomId, ...userIds]
    );
    return rows;
};

// ============================================================
// room_members
// ============================================================

/**
 * 특정 채팅방의 멤버 목록. users 정보 JOIN.
 */
exports.findMembersByRoomId = async (roomId) => {
    const { rows } = await pool.query(
        `SELECT u.id,
                u.handle,
                u.name,
                u.profile_image,
                rm.joined_at
           FROM chatdata.room_members rm
           JOIN chatdata.users u ON u.id = rm.user_id
          WHERE rm.room_id = $1
          ORDER BY rm.joined_at ASC`,
        [roomId]
    );
    return rows;
};

/**
 * 특정 사용자가 특정 채팅방의 멤버인지 확인. 없으면 null.
 */
exports.findMembership = async (roomId, userId) => {
    const { rows } = await pool.query(
        `SELECT id, room_id, user_id, last_read_message_id, joined_at
           FROM chatdata.room_members
          WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
    );
    return rows[0] || null;
};

/**
 * 내가 속한 채팅방 목록. 최근 메시지 순 정렬.
 * last_message, unread_count 포함.
 */
exports.findRoomsByUserId = async (userId) => {
    const { rows } = await pool.query(
        `SELECT
            cr.id,
            cr.type,
            cr.name,
            cr.created_at,
            cr.updated_at,
            -- last_message 서브쿼리
            lm.id          AS lm_id,
            lm.content     AS lm_content,
            lm.sender_id   AS lm_sender_id,
            lm.is_deleted  AS lm_is_deleted,
            lm.created_at  AS lm_created_at,
            -- unread_count: 본인 외 발신자의 메시지 중 last_read_message_id 이후
            (
                SELECT COUNT(*)::int
                  FROM chatdata.messages m2
                 WHERE m2.room_id = cr.id
                   AND m2.sender_id <> $1
                   AND m2.id > COALESCE(my_rm.last_read_message_id, 0)
                   AND m2.is_deleted = FALSE
            ) AS unread_count
           FROM chatdata.room_members my_rm
           JOIN chatdata.chat_rooms cr ON cr.id = my_rm.room_id
           -- 마지막 메시지
           LEFT JOIN LATERAL (
               SELECT id, content, sender_id, is_deleted, created_at
                 FROM chatdata.messages
                WHERE room_id = cr.id
                ORDER BY id DESC
                LIMIT 1
           ) lm ON TRUE
          WHERE my_rm.user_id = $1
          ORDER BY COALESCE(lm.created_at, cr.created_at) DESC`,
        [userId]
    );
    return rows;
};

/**
 * 여러 채팅방의 멤버를 한 번에 조회 (N+1 방지).
 * 반환: { room_id, id, handle, name, profile_image }[]
 */
exports.findMembersForRooms = async (roomIds) => {
    if (roomIds.length === 0) return [];
    const { rows } = await pool.query(
        `SELECT rm.room_id,
                u.id,
                u.handle,
                u.name,
                u.profile_image
           FROM chatdata.room_members rm
           JOIN chatdata.users u ON u.id = rm.user_id
          WHERE rm.room_id = ANY($1::uuid[])`,
        [roomIds]
    );
    return rows;
};

/**
 * 채팅방 멤버들의 users 정보 반환 (채팅방 생성 응답용).
 */
exports.findMembersWithUserInfo = async (roomId) => {
    const { rows } = await pool.query(
        `SELECT u.id,
                u.handle,
                u.name,
                u.profile_image
           FROM chatdata.room_members rm
           JOIN chatdata.users u ON u.id = rm.user_id
          WHERE rm.room_id = $1`,
        [roomId]
    );
    return rows;
};

/**
 * last_read_message_id 갱신.
 */
exports.updateLastRead = async (roomId, userId, lastMessageId) => {
    await pool.query(
        `UPDATE chatdata.room_members
            SET last_read_message_id = $3
          WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId, lastMessageId]
    );
};

/**
 * 채팅방에서 멤버 삭제.
 */
exports.deleteMembership = async (roomId, userId) => {
    const { rowCount } = await pool.query(
        `DELETE FROM chatdata.room_members
          WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
    );
    return rowCount;
};

/**
 * 특정 채팅방의 모든 멤버 user_id 배열 반환 (Socket emit 대상 확인용).
 */
exports.findMemberUserIds = async (roomId) => {
    const { rows } = await pool.query(
        `SELECT user_id FROM chatdata.room_members WHERE room_id = $1`,
        [roomId]
    );
    return rows.map((r) => r.user_id);
};

// ============================================================
// messages
// ============================================================

/**
 * 새 메시지 insert.
 */
exports.insertMessage = async ({ roomId, senderId, content, mediaUrl }) => {
    const { rows } = await pool.query(
        `INSERT INTO chatdata.messages (room_id, sender_id, content, media_url, is_deleted)
         VALUES ($1, $2, $3, $4, FALSE)
         RETURNING id, room_id, sender_id, content, media_url, is_deleted, created_at`,
        [roomId, senderId, content || null, mediaUrl || null]
    );
    return rows[0];
};

/**
 * 메시지 id로 조회. 없으면 null.
 */
exports.findMessageById = async (id) => {
    const { rows } = await pool.query(
        `SELECT id, room_id, sender_id, content, media_url, is_deleted, created_at
           FROM chatdata.messages
          WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
};

/**
 * 메시지 soft delete (is_deleted = true).
 */
exports.softDeleteMessage = async (id) => {
    const { rows } = await pool.query(
        `UPDATE chatdata.messages
            SET is_deleted = TRUE
          WHERE id = $1
          RETURNING id, room_id, sender_id, is_deleted`,
        [id]
    );
    return rows[0] || null;
};

/**
 * 채팅방 메시지 내역 cursor 페이지네이션.
 * cursor 미지정 시 최신 limit개 반환.
 * cursor 지정 시 cursor id 미만 메시지를 최신순 limit개.
 */
exports.findMessagesByRoomId = async (roomId, cursor, limit) => {
    if (cursor) {
        const { rows } = await pool.query(
            `SELECT id, sender_id, content, media_url, is_deleted, created_at
               FROM chatdata.messages
              WHERE room_id = $1
                AND id < $2
              ORDER BY id DESC
              LIMIT $3`,
            [roomId, cursor, limit]
        );
        return rows;
    } else {
        const { rows } = await pool.query(
            `SELECT id, sender_id, content, media_url, is_deleted, created_at
               FROM chatdata.messages
              WHERE room_id = $1
              ORDER BY id DESC
              LIMIT $2`,
            [roomId, limit]
        );
        return rows;
    }
};

// ============================================================
// friendships (친구 관계 확인)
// ============================================================

/**
 * 두 사용자가 accepted 친구 관계인지 확인.
 */
exports.areFriends = async (userAId, userBId) => {
    const { rows } = await pool.query(
        `SELECT 1
           FROM chatdata.friendships
          WHERE status = 'accepted'::chatdata.friend_status
            AND (
                  (requester_id = $1 AND addressee_id = $2)
               OR (requester_id = $2 AND addressee_id = $1)
            )
          LIMIT 1`,
        [userAId, userBId]
    );
    return rows.length > 0;
};

/**
 * users 테이블에서 id 배열로 존재 여부 확인. 존재하는 id만 반환.
 */
exports.findUsersByIds = async (userIds) => {
    if (userIds.length === 0) return [];
    const { rows } = await pool.query(
        `SELECT id FROM chatdata.users WHERE id = ANY($1::uuid[])`,
        [userIds]
    );
    return rows.map((r) => r.id);
};

// ============================================================
// notifications (멤버 초대 알림)
// ============================================================

/**
 * chat_invite 알림 insert (초대된 사용자별).
 */
exports.insertChatInviteNotifications = async (actorId, roomId, userIds, client) => {
    if (userIds.length === 0) return;
    const db = client || pool;
    const placeholders = userIds
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, 'chat_invite'::chatdata.notification_type, $${i * 3 + 3})`)
        .join(', ');
    const values = userIds.flatMap((uid) => [uid, actorId, roomId]);
    await db.query(
        `INSERT INTO chatdata.notifications (user_id, actor_id, type, target_id)
         VALUES ${placeholders}`,
        values
    );
};

/**
 * DB 트랜잭션 클라이언트 획득.
 */
exports.getClient = async () => {
    return pool.connect();
};