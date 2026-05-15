const messengerService = require('../services/messenger');
const { ValidationError } = require('../errors/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIGINT_RE = /^\d+$/;

const isValidUUID = (v) => typeof v === 'string' && UUID_RE.test(v);

// ============================================================
// POST /chat-rooms — 채팅방 생성
// ============================================================
exports.createRoom = async (req, res, next) => {
    try {
        const { type, name, members } = req.body || {};

        // 형식 검증
        if (!type || !['direct', 'group'].includes(type)) {
            throw new ValidationError('INVALID_TYPE', 'type을 지정해주세요.');
        }

        if (!Array.isArray(members) || members.length === 0) {
            throw new ValidationError('INVALID_MEMBERS', '1:1 채팅은 1명, 그룹은 2명 이상의 멤버가 필요합니다.');
        }

        if (type === 'direct' && members.length !== 1) {
            throw new ValidationError('INVALID_MEMBERS', '1:1 채팅은 1명, 그룹은 2명 이상의 멤버가 필요합니다.');
        }

        if (type === 'group' && members.length < 2) {
            throw new ValidationError('INVALID_MEMBERS', '1:1 채팅은 1명, 그룹은 2명 이상의 멤버가 필요합니다.');
        }

        // members 각 항목 UUID 형식 검증
        for (const mid of members) {
            if (!isValidUUID(mid)) {
                throw new ValidationError('INVALID_MEMBERS', '멤버 ID 형식이 올바르지 않습니다.');
            }
        }

        const { room, existed } = await messengerService.createRoom({
            type,
            name,
            memberIds: members,
            requesterId: req.user.id
        });

        const statusCode = existed ? 200 : 201;

        return res.status(statusCode).json({
            data: {
                success: true,
                message: '채팅방이 생성되었습니다.',
                room
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /chat-rooms — 내 채팅방 목록
// ============================================================
exports.getRooms = async (req, res, next) => {
    try {
        const rooms = await messengerService.getRooms(req.user.id);

        return res.status(200).json({
            data: {
                success: true,
                rooms
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /chat-rooms/:id/messages — 메시지 내역 조회
// ============================================================
exports.getMessages = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            throw new ValidationError('INVALID_ROOM_ID', '채팅방 ID 형식이 올바르지 않습니다.');
        }

        const { cursor, limit: limitStr } = req.query;
        const limit = Math.min(parseInt(limitStr, 10) || 30, 100);

        if (cursor && !BIGINT_RE.test(cursor)) {
            throw new ValidationError('INVALID_CURSOR', 'cursor 형식이 올바르지 않습니다.');
        }

        const { messages, next_cursor } = await messengerService.getMessages({
            roomId: id,
            userId: req.user.id,
            cursor: cursor || null,
            limit
        });

        return res.status(200).json({
            data: {
                success: true,
                messages,
                next_cursor
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /chat-rooms/:id/messages/upload — 채팅 이미지 업로드
// ============================================================
exports.uploadMessageImage = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            throw new ValidationError('INVALID_ROOM_ID', '채팅방 ID 형식이 올바르지 않습니다.');
        }

        if (!req.file) {
            throw new ValidationError('NO_FILE', '파일을 업로드해주세요.');
        }

        const media_url = await messengerService.uploadChatMedia({
            roomId: id,
            userId: req.user.id,
            fileBuffer: req.file.buffer,
            mimetype: req.file.mimetype
        });

        return res.status(200).json({ data: { media_url } });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// DELETE /messages/:id — 메시지 삭제
// ============================================================
exports.deleteMessage = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!BIGINT_RE.test(id)) {
            throw new ValidationError('INVALID_MESSAGE_ID', '메시지 ID 형식이 올바르지 않습니다.');
        }

        const { roomId, messageId } = await messengerService.deleteMessage({
            messageId: id,
            userId: req.user.id
        });

        // Socket emit: 같은 채팅방 멤버 전원에게 message:deleted
        const io = req.app.get('io');
        if (io) {
            io.to(`room:${roomId}`).emit('message:deleted', {
                message_id: String(messageId),
                room_id: roomId
            });
        }

        return res.status(200).json({
            data: {
                success: true,
                message: '메시지가 삭제되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// POST /chat-rooms/:id/members — 멤버 초대
// ============================================================
exports.inviteMembers = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            throw new ValidationError('INVALID_ROOM_ID', '채팅방 ID 형식이 올바르지 않습니다.');
        }

        const { user_ids } = req.body || {};

        if (!Array.isArray(user_ids) || user_ids.length === 0) {
            throw new ValidationError('INVALID_USER_IDS', 'user_ids를 올바르게 입력해주세요.');
        }

        for (const uid of user_ids) {
            if (!isValidUUID(uid)) {
                throw new ValidationError('INVALID_USER_IDS', '사용자 ID 형식이 올바르지 않습니다.');
            }
        }

        const { added_count } = await messengerService.inviteMembers({
            roomId: id,
            inviterUserId: req.user.id,
            userIds: user_ids
        });

        return res.status(201).json({
            data: {
                success: true,
                message: '멤버가 초대되었습니다.',
                added_count
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// GET /chat-rooms/:id/members — 멤버 목록 조회
// ============================================================
exports.getMembers = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            throw new ValidationError('INVALID_ROOM_ID', '채팅방 ID 형식이 올바르지 않습니다.');
        }

        const members = await messengerService.getMembers({
            roomId: id,
            userId: req.user.id
        });

        return res.status(200).json({
            data: {
                success: true,
                members
            }
        });
    } catch (err) {
        next(err);
    }
};

// ============================================================
// DELETE /chat-rooms/:id/members/me — 채팅방 나가기
// ============================================================
exports.leaveRoom = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            throw new ValidationError('INVALID_ROOM_ID', '채팅방 ID 형식이 올바르지 않습니다.');
        }

        await messengerService.leaveRoom({
            roomId: id,
            userId: req.user.id
        });

        return res.status(204).send();
    } catch (err) {
        next(err);
    }
};