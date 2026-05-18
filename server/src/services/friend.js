const friendshipRepo = require('../repositories/friendship');
const userRepo = require('../repositories/user');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError
} = require('../errors/AppError');

/**
 * handle로 사용자 검색 (ILIKE 부분 일치, 본인 제외).
 */
exports.searchUsers = async ({ handle, selfId }) => {
    const users = await friendshipRepo.searchUsersByHandle(handle, selfId);
    return users;
};

/**
 * 친구 신청.
 * 비즈니스 검증:
 *   - addressee 존재 여부 (404)
 *   - 이미 accepted 관계 (409 '이미 친구입니다.')
 *   - 이미 pending 관계 (409 '이미 신청을 보냈습니다.')
 */
exports.sendRequest = async ({ requesterId, addresseeId }) => {
    // addressee 존재 확인
    const addressee = await userRepo.findById(addresseeId);
    if (!addressee) {
        throw new NotFoundError('USER_NOT_FOUND', '존재하지 않는 사용자입니다.');
    }

    // 양방향 기존 관계 조회
    const existing = await friendshipRepo.findRelation(requesterId, addresseeId);
    if (existing) {
        if (existing.status === 'accepted') {
            throw new ConflictError('ALREADY_FRIENDS', '이미 친구입니다.');
        }
        // pending — 방향 무관하게 이미 신청 존재로 처리
        throw new ConflictError('REQUEST_PENDING', '이미 신청을 보냈습니다.');
    }

    try {
        await friendshipRepo.insertPendingWithNotification({ requesterId, addresseeId });
    } catch (err) {
        if (err.code === '23505') {
            // 동시 신청 race — 다시 한번 상태 확인
            const raceExisting = await friendshipRepo.findRelation(requesterId, addresseeId);
            if (raceExisting && raceExisting.status === 'accepted') {
                throw new ConflictError('ALREADY_FRIENDS', '이미 친구입니다.');
            }
            throw new ConflictError('ALREADY_REQUESTED', '이미 신청을 보냈습니다.');
        }
        throw err;
    }
};

/**
 * 친구 신청 수락.
 * 비즈니스 검증:
 *   - friendship 존재 여부 (404)
 *   - 본인이 addressee인지 (403)
 *   - 이미 accepted (409)
 */
exports.acceptRequest = async ({ friendshipId, userId }) => {
    const friendship = await friendshipRepo.findById(friendshipId);
    if (!friendship) {
        throw new NotFoundError('FRIENDSHIP_NOT_FOUND', '친구 신청을 찾을 수 없습니다.');
    }

    if (friendship.addressee_id !== userId) {
        throw new ForbiddenError('FORBIDDEN', '수락 권한이 없습니다.');
    }

    const updated = await friendshipRepo.acceptByIdWithNotification(friendshipId);
    if (!updated) {
        // status가 이미 'accepted'였거나 동시 다른 요청이 먼저 처리한 경우
        throw new ConflictError('ALREADY_ACCEPTED', '이미 처리된 신청입니다.');
    }
};

/**
 * 친구 관계 삭제 (거절 / 신청 취소 / 친구 끊기).
 * 비즈니스 검증:
 *   - friendship 존재 여부 (404)
 *   - 본인이 requester 또는 addressee인지 (403)
 */
exports.deleteRelation = async ({ friendshipId, userId }) => {
    const friendship = await friendshipRepo.findById(friendshipId);
    if (!friendship) {
        throw new NotFoundError('FRIENDSHIP_NOT_FOUND', '친구 관계를 찾을 수 없습니다.');
    }

    const isMember =
        friendship.requester_id === userId || friendship.addressee_id === userId;
    if (!isMember) {
        throw new ForbiddenError('FORBIDDEN', '권한이 없습니다.');
    }

    await friendshipRepo.deleteById(friendshipId);
};

/**
 * 친구 목록 / 신청 목록 조회.
 * rows를 { id, user: {...}, status, created_at } 형태로 변환해 반환.
 */
exports.listFriendships = async ({ userId, status, direction }) => {
    let rows;

    if (status === 'accepted') {
        rows = await friendshipRepo.listAccepted(userId);
    } else if (status === 'pending') {
        if (direction === 'incoming') {
            rows = await friendshipRepo.listPendingIncoming(userId);
        } else if (direction === 'outgoing') {
            rows = await friendshipRepo.listPendingOutgoing(userId);
        } else {
            rows = await friendshipRepo.listPendingBoth(userId);
        }
    } else {
        throw new ValidationError('INVALID_STATUS', '유효하지 않은 status 값입니다.');
    }

    return rows.map((row) => ({
        id: row.id,
        user: {
            id: row.user_id,
            handle: row.user_handle,
            name: row.user_name,
            profile_image: row.user_profile_image
        },
        status: row.status,
        created_at: row.created_at
    }));
};
