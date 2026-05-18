const messengerRepo = require('../repositories/messenger');
const storageService = require('./storage');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError
} = require('../errors/AppError');

// ============================================================
// 채팅방 생성
// ============================================================

/**
 * 1:1 또는 그룹 채팅방 생성.
 * - 1:1: direct_key로 중복 방지. 이미 존재하면 기존 방 반환 (existed: true).
 * - 그룹: 항상 신규 생성.
 * 비즈니스 검증:
 *   - members 중 존재하지 않는 사용자 (404)
 *   - 친구 아닌 사용자 포함 (403)
 *   - 1:1: members 수 !== 1
 *   - 그룹: members 수 < 2
 */
exports.createRoom = async ({ type, name, memberIds, requesterId }) => {
    // members 존재 확인
    const foundIds = await messengerRepo.findUsersByIds(memberIds);
    if (foundIds.length !== memberIds.length) {
        throw new NotFoundError('USER_NOT_FOUND', '존재하지 않는 사용자가 포함되어 있습니다.');
    }

    // 친구 관계 확인 (모든 member에 대해)
    for (const memberId of memberIds) {
        const friends = await messengerRepo.areFriends(requesterId, memberId);
        if (!friends) {
            throw new ForbiddenError('NOT_FRIEND', '친구만 채팅방에 추가할 수 있습니다.');
        }
    }

    const allUserIds = [requesterId, ...memberIds];

    if (type === 'direct') {
        // 1:1 채팅방: direct_key 중복 방지
        const [a, b] = [requesterId, memberIds[0]];
        const directKey = [a, b].sort().join('_'); // LEAST/GREATEST 문자열 정렬

        // 존재 확인 → 기존 방 반환
        const existing = await messengerRepo.findRoomByDirectKey(directKey);
        if (existing) {
            const members = await messengerRepo.findMembersWithUserInfo(existing.id);
            return { room: { id: existing.id, type: existing.type, name: existing.name, members }, existed: true };
        }

        // 신규 생성 (트랜잭션)
        const client = await messengerRepo.getClient();
        try {
            await client.query('BEGIN');
            let room;
            try {
                room = await messengerRepo.insertRoom({ type: 'direct', name: null, directKey }, client);
            } catch (insertErr) {
                // 23505: unique violation (race condition)
                if (insertErr.code === '23505') {
                    await client.query('ROLLBACK');
                    client.release();
                    const raceFallback = await messengerRepo.findRoomByDirectKey(directKey);
                    const members = await messengerRepo.findMembersWithUserInfo(raceFallback.id);
                    return { room: { id: raceFallback.id, type: raceFallback.type, name: raceFallback.name, members }, existed: true };
                }
                throw insertErr;
            }
            await messengerRepo.insertRoomMembers(room.id, allUserIds, client);
            await client.query('COMMIT');
            client.release();
            const members = await messengerRepo.findMembersWithUserInfo(room.id);
            return { room: { id: room.id, type: room.type, name: room.name, members }, existed: false };
        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            throw err;
        }
    } else {
        // 그룹 채팅방: 항상 신규 (트랜잭션)
        const client = await messengerRepo.getClient();
        try {
            await client.query('BEGIN');
            const room = await messengerRepo.insertRoom({ type: 'group', name: name || null, directKey: null }, client);
            await messengerRepo.insertRoomMembers(room.id, allUserIds, client);
            await client.query('COMMIT');
            client.release();
            const members = await messengerRepo.findMembersWithUserInfo(room.id);
            return { room: { id: room.id, type: room.type, name: room.name, members }, existed: false };
        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            throw err;
        }
    }
};

// ============================================================
// 채팅방 목록 조회
// ============================================================

/**
 * 본인이 속한 채팅방 목록 반환.
 * last_message + unread_count 포함.
 */
exports.getRooms = async (userId) => {
    const rows = await messengerRepo.findRoomsByUserId(userId);

    // 모든 채팅방의 멤버 정보를 한 번에 조회 (N+1 방지)
    const roomIds = rows.map((r) => r.id);
    const allMembers = await messengerRepo.findMembersForRooms(roomIds);
    const membersByRoom = {};
    for (const member of allMembers) {
        const { room_id, ...userInfo } = member;
        if (!membersByRoom[room_id]) membersByRoom[room_id] = [];
        membersByRoom[room_id].push(userInfo);
    }

    return rows.map((row) => {
        let lastMessage = null;
        if (row.lm_id !== null) {
            lastMessage = {
                content: row.lm_is_deleted ? '삭제된 메시지입니다' : row.lm_content,
                sender_id: row.lm_sender_id,
                created_at: row.lm_created_at
            };
        }
        return {
            id: row.id,
            type: row.type,
            name: row.name,
            members: membersByRoom[row.id] || [],
            last_message: lastMessage,
            unread_count: row.unread_count
        };
    });
};

// ============================================================
// 메시지 내역 조회
// ============================================================

/**
 * 채팅방 메시지 cursor 페이지네이션.
 * 비즈니스 검증:
 *   - 채팅방 존재 (404)
 *   - 본인이 멤버 (403)
 */
exports.getMessages = async ({ roomId, userId, cursor, limit }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    const messages = await messengerRepo.findMessagesByRoomId(roomId, cursor || null, limit);

    const formatted = messages.map((m) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.is_deleted ? '삭제된 메시지입니다' : m.content,
        media_url: m.is_deleted ? null : m.media_url,
        is_deleted: m.is_deleted,
        created_at: m.created_at
    }));

    // next_cursor: 반환된 메시지 중 가장 오래된 id (제일 마지막 항목)
    const nextCursor = messages.length === limit ? String(messages[messages.length - 1].id) : null;

    return { messages: formatted, next_cursor: nextCursor };
};

// ============================================================
// 메시지 삭제
// ============================================================

/**
 * 본인 메시지 soft delete.
 * 비즈니스 검증:
 *   - 메시지 존재 (404)
 *   - 본인이 발신자 (403)
 * 반환: { message, roomId } — 컨트롤러가 Socket emit에 사용.
 */
exports.deleteMessage = async ({ messageId, userId }) => {
    const msg = await messengerRepo.findMessageById(messageId);
    if (!msg || msg.is_deleted) {
        throw new NotFoundError('MESSAGE_NOT_FOUND', '메시지를 찾을 수 없습니다.');
    }

    if (msg.sender_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '본인 메시지만 삭제할 수 있습니다.');
    }

    await messengerRepo.softDeleteMessage(messageId);

    return { roomId: msg.room_id, messageId: msg.id };
};

// ============================================================
// 채팅방 멤버 초대
// ============================================================

/**
 * 그룹 채팅방에 친구 초대.
 * 비즈니스 검증:
 *   - 채팅방 존재 (404)
 *   - direct 채팅방 (400)
 *   - 본인이 멤버 (403 '채팅방 멤버만 초대할 수 있습니다.')
 *   - 친구 아닌 사용자 (403 '친구만 초대할 수 있습니다.')
 *   - 이미 멤버인 사용자 (409)
 */
exports.inviteMembers = async ({ roomId, inviterUserId, userIds }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    if (room.type === 'direct') {
        throw new ValidationError('DIRECT_ROOM', '1:1 채팅방에는 멤버를 추가할 수 없습니다.');
    }

    // 초대자가 멤버인지 확인
    const inviterMembership = await messengerRepo.findMembership(roomId, inviterUserId);
    if (!inviterMembership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버만 초대할 수 있습니다.');
    }

    // 초대할 사용자 존재 확인
    const foundIds = await messengerRepo.findUsersByIds(userIds);
    if (foundIds.length !== userIds.length) {
        throw new NotFoundError('USER_NOT_FOUND', '존재하지 않는 사용자가 포함되어 있습니다.');
    }

    // 친구 관계 확인
    for (const uid of userIds) {
        const friends = await messengerRepo.areFriends(inviterUserId, uid);
        if (!friends) {
            throw new ForbiddenError('NOT_FRIEND', '친구만 초대할 수 있습니다.');
        }
    }

    // 이미 멤버인지 확인
    for (const uid of userIds) {
        const existing = await messengerRepo.findMembership(roomId, uid);
        if (existing) {
            throw new ConflictError('ALREADY_MEMBER', '이미 멤버인 사용자가 포함되어 있습니다.');
        }
    }

    const client = await messengerRepo.getClient();
    try {
        await client.query('BEGIN');
        await messengerRepo.insertRoomMembers(roomId, userIds, client);
        await messengerRepo.insertChatInviteNotifications(inviterUserId, roomId, userIds, client);
        await client.query('COMMIT');
        client.release();
    } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
    }

    return { added_count: userIds.length };
};

// ============================================================
// 채팅방 멤버 목록 조회
// ============================================================

/**
 * 채팅방 멤버 목록.
 * 비즈니스 검증:
 *   - 채팅방 존재 (404)
 *   - 본인이 멤버 (403)
 */
exports.getMembers = async ({ roomId, userId }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    return messengerRepo.findMembersByRoomId(roomId);
};

// ============================================================
// 채팅방 이름 변경
// ============================================================

/**
 * 그룹 채팅방 이름 변경.
 * 비즈니스 검증:
 *   - 채팅방 존재 (404)
 *   - direct 채팅방 (400)
 *   - 본인이 멤버 (403)
 */
exports.renameRoom = async ({ roomId, userId, name }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    if (room.type === 'direct') {
        throw new ValidationError('DIRECT_ROOM', '1:1 채팅방은 이름을 변경할 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    return messengerRepo.updateRoomName(roomId, name);
};

// ============================================================
// 채팅방 나가기
// ============================================================

/**
 * 본인을 채팅방에서 제외.
 * 비즈니스 검증:
 *   - 채팅방 존재 + 본인이 멤버 (404 통합)
 */
exports.leaveRoom = async ({ roomId, userId }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    await messengerRepo.deleteMembership(roomId, userId);
};

// ============================================================
// 채팅 이미지 업로드
// ============================================================

/**
 * 채팅방 이미지 업로드.
 * 비즈니스 검증:
 *   - 채팅방 존재 (404)
 *   - 본인이 멤버 (403)
 * 반환: media_url (상대 경로)
 */
exports.uploadChatMedia = async ({ roomId, userId, fileBuffer, mimetype }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    return storageService.saveChatMedia(fileBuffer, mimetype);
};

// ============================================================
// Socket — message:send
// ============================================================

/**
 * 메시지 전송 (Socket 핸들러에서 호출).
 * 비즈니스 검증:
 *   - 빈 메시지 (content + media_url 모두 없음)
 *   - 채팅방 존재 (ROOM_NOT_FOUND)
 *   - 본인이 멤버 (NOT_MEMBER)
 * 반환: 삽입된 message row
 */
exports.sendMessage = async ({ roomId, senderId, content, mediaUrl }) => {
    if (!content && !mediaUrl) {
        throw new ValidationError('EMPTY_MESSAGE', '빈 메시지는 보낼 수 없습니다.');
    }

    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, senderId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    const message = await messengerRepo.insertMessage({ roomId, senderId, content, mediaUrl });
    return message;
};

// ============================================================
// Socket — message:read
// ============================================================

/**
 * 메시지 읽음 처리 (Socket 핸들러에서 호출).
 * 비즈니스 검증:
 *   - 채팅방 존재 + 본인이 멤버
 */
exports.markRead = async ({ roomId, userId, lastMessageId }) => {
    const room = await messengerRepo.findRoomById(roomId);
    if (!room) {
        throw new NotFoundError('ROOM_NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    }

    const membership = await messengerRepo.findMembership(roomId, userId);
    if (!membership) {
        throw new ForbiddenError('NOT_MEMBER', '채팅방 멤버가 아닙니다.');
    }

    await messengerRepo.updateLastRead(roomId, userId, lastMessageId);
};