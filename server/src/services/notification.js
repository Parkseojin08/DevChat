const notificationRepo = require('../repositories/notification');
const {
    NotFoundError,
    ForbiddenError
} = require('../errors/AppError');

/**
 * row를 API 응답 형식(actor 중첩)으로 변환.
 * actor_id가 null(예: 시스템 알림, 또는 actor 계정 삭제로 SET NULL)일 경우 actor도 null.
 */
const formatRow = (row) => ({
    id: row.id,
    type: row.type,
    actor: row.actor_id
        ? {
              id: row.actor_id,
              handle: row.actor_handle,
              name: row.actor_name,
              profile_image: row.actor_profile_image
          }
        : null,
    target_id: row.target_id,
    is_read: row.is_read,
    created_at: row.created_at
});

/**
 * cursor 문자열을 { createdAt, id } 로 파싱. 형식 오류면 null 반환 (커서 무시).
 * 형식: "{ISO timestamp}|{bigint id}"
 */
const parseCursor = (cursor) => {
    if (!cursor || typeof cursor !== 'string') return null;
    const sep = cursor.lastIndexOf('|');
    if (sep <= 0) return null;
    const createdAt = cursor.slice(0, sep);
    const id = cursor.slice(sep + 1);
    if (!/^\d+$/.test(id)) return null;
    // timestamp 형식 검증은 DB 캐스팅에 위임하되 빠른 검증으로 길이만 확인
    if (createdAt.length < 10) return null;
    return { createdAt, id };
};

const buildCursor = (row) => {
    // row.created_at은 Date 객체. ISO 문자열로 직렬화.
    const ts = row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
    return `${ts}|${row.id}`;
};

/**
 * 알림 목록 조회.
 * - limit+1개 가져와 next_cursor 판단
 * - unread_count는 매 호출 시 별도 계산 (목록과 무관하게 전체 미읽음 수)
 */
exports.listNotifications = async ({ userId, cursor, limit, unread }) => {
    const parsedCursor = parseCursor(cursor);
    const rows = await notificationRepo.listNotifications({
        userId,
        cursor: parsedCursor,
        limit: limit + 1,
        unread
    });

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = hasNext ? buildCursor(pageRows[pageRows.length - 1]) : null;

    const unreadCount = await notificationRepo.countUnread(userId);

    return {
        notifications: pageRows.map(formatRow),
        next_cursor: nextCursor,
        unread_count: unreadCount
    };
};

/**
 * 개별 알림 읽음 처리.
 *  - 존재 X → 404
 *  - 본인 알림 아님 → 403
 *  - 이미 읽음 상태여도 idempotent하게 성공 (다시 갱신해도 무해)
 */
exports.markAsRead = async ({ notificationId, userId }) => {
    const notif = await notificationRepo.findById(notificationId);
    if (!notif) {
        throw new NotFoundError('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.');
    }
    if (notif.user_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인 알림만 처리할 수 있습니다.');
    }

    if (!notif.is_read) {
        await notificationRepo.markAsRead(notificationId);
    }

    const unreadCount = await notificationRepo.countUnread(userId);
    return { unread_count: unreadCount };
};

/**
 * 본인의 모든 미읽음 알림을 일괄 읽음 처리.
 */
exports.markAllAsRead = async ({ userId }) => {
    await notificationRepo.markAllAsRead(userId);
    return { unread_count: 0 };
};

/**
 * 알림 삭제.
 *  - 존재 X → 404
 *  - 본인 알림 아님 → 403
 */
exports.deleteNotification = async ({ notificationId, userId }) => {
    const notif = await notificationRepo.findById(notificationId);
    if (!notif) {
        throw new NotFoundError('NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없습니다.');
    }
    if (notif.user_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인 알림만 삭제할 수 있습니다.');
    }

    await notificationRepo.deleteById(notificationId);
};
