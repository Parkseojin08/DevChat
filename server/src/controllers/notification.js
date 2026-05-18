const notificationService = require('../services/notification');
const { ValidationError } = require('../errors/AppError');

const BIGINT_RE = /^\d+$/;
const isValidBigInt = (v) => typeof v === 'string' && BIGINT_RE.test(v);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /notifications?cursor=&limit=&unread=
exports.listNotifications = async (req, res, next) => {
    try {
        const { cursor, limit, unread } = req.query;

        // limit 검증
        let parsedLimit = DEFAULT_LIMIT;
        if (limit !== undefined) {
            if (typeof limit !== 'string' || !/^\d+$/.test(limit)) {
                throw new ValidationError('INVALID_LIMIT', 'limit이 올바르지 않습니다.');
            }
            parsedLimit = parseInt(limit, 10);
            if (parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
                throw new ValidationError(
                    'INVALID_LIMIT',
                    `limit은 1 이상 ${MAX_LIMIT} 이하여야 합니다.`
                );
            }
        }

        // unread 검증 (선택)
        let parsedUnread = false;
        if (unread !== undefined) {
            if (unread === 'true') parsedUnread = true;
            else if (unread === 'false') parsedUnread = false;
            else throw new ValidationError('INVALID_UNREAD', 'unread는 true 또는 false여야 합니다.');
        }

        // cursor는 형식 위배 시 service에서 무시(=처음부터 조회). controller는 string 타입만 통과.
        const parsedCursor = typeof cursor === 'string' && cursor.length > 0 ? cursor : null;

        const result = await notificationService.listNotifications({
            userId: req.user.id,
            cursor: parsedCursor,
            limit: parsedLimit,
            unread: parsedUnread
        });

        return res.status(200).json({
            data: {
                success: true,
                notifications: result.notifications,
                next_cursor: result.next_cursor,
                unread_count: result.unread_count
            }
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /notifications/read-all  (일괄)
// 정의 순서 주의: Express 라우터에서 read-all을 :id보다 먼저 등록해야 함.
exports.markAllAsRead = async (req, res, next) => {
    try {
        const result = await notificationService.markAllAsRead({ userId: req.user.id });
        return res.status(200).json({
            data: {
                success: true,
                message: '모든 알림을 읽음 처리하였습니다.',
                unread_count: result.unread_count
            }
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /notifications/:id  (개별)
exports.markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!isValidBigInt(id)) {
            throw new ValidationError('INVALID_ID', 'id가 올바르지 않습니다.');
        }

        const result = await notificationService.markAsRead({
            notificationId: id,
            userId: req.user.id
        });

        return res.status(200).json({
            data: {
                success: true,
                message: '알림을 읽음 처리하였습니다.',
                unread_count: result.unread_count
            }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /notifications/:id
exports.deleteNotification = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!isValidBigInt(id)) {
            throw new ValidationError('INVALID_ID', 'id가 올바르지 않습니다.');
        }

        await notificationService.deleteNotification({
            notificationId: id,
            userId: req.user.id
        });

        return res.status(204).send();
    } catch (err) {
        next(err);
    }
};
