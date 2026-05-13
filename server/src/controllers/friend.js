const friendService = require('../services/friend');
const { ValidationError } = require('../errors/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIGINT_RE = /^\d+$/;

const isValidUUID = (v) => typeof v === 'string' && UUID_RE.test(v);
const isValidBigInt = (v) => typeof v === 'string' && BIGINT_RE.test(v);

// GET /friendships/search?handle=xxx
exports.searchUsers = async (req, res, next) => {
    try {
        const { handle } = req.query;

        if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
            throw new ValidationError('MISSING_HANDLE', '검색어를 입력해주세요.');
        }

        const users = await friendService.searchUsers({
            handle: handle.trim(),
            selfId: req.user.id
        });

        return res.status(200).json({
            data: {
                success: true,
                users
            }
        });
    } catch (err) {
        next(err);
    }
};

// POST /friendships
exports.sendRequest = async (req, res, next) => {
    try {
        const { addressee_id } = req.body || {};

        if (!isValidUUID(addressee_id)) {
            throw new ValidationError('INVALID_ADDRESSEE_ID', 'addressee_id가 올바르지 않습니다.');
        }

        if (addressee_id === req.user.id) {
            throw new ValidationError('SELF_REQUEST', '본인에게 친구 신청할 수 없습니다.');
        }

        await friendService.sendRequest({
            requesterId: req.user.id,
            addresseeId: addressee_id
        });

        return res.status(201).json({
            data: {
                success: true,
                message: '친구 신청이 전송되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /friendships/:id
exports.acceptRequest = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidBigInt(id)) {
            throw new ValidationError('INVALID_ID', 'id가 올바르지 않습니다.');
        }

        await friendService.acceptRequest({
            friendshipId: id,
            userId: req.user.id
        });

        return res.status(200).json({
            data: {
                success: true,
                message: '친구가 추가되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

// DELETE /friendships/:id
exports.deleteRelation = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidBigInt(id)) {
            throw new ValidationError('INVALID_ID', 'id가 올바르지 않습니다.');
        }

        await friendService.deleteRelation({
            friendshipId: id,
            userId: req.user.id
        });

        return res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// GET /friendships?status=accepted|pending&direction=incoming|outgoing
exports.listFriendships = async (req, res, next) => {
    try {
        const { status, direction } = req.query;

        const VALID_STATUS = ['accepted', 'pending'];
        const VALID_DIRECTION = ['incoming', 'outgoing'];

        if (!status || !VALID_STATUS.includes(status)) {
            throw new ValidationError('INVALID_STATUS', 'status를 지정해주세요.');
        }

        if (status === 'accepted' && direction !== undefined) {
            throw new ValidationError('INVALID_DIRECTION', 'direction은 status=pending일 때만 사용할 수 있습니다.');
        }

        if (direction !== undefined && !VALID_DIRECTION.includes(direction)) {
            throw new ValidationError('INVALID_DIRECTION', 'direction은 incoming 또는 outgoing이어야 합니다.');
        }

        const friendships = await friendService.listFriendships({
            userId: req.user.id,
            status,
            direction
        });

        return res.status(200).json({
            data: {
                success: true,
                friendships
            }
        });
    } catch (err) {
        next(err);
    }
};
