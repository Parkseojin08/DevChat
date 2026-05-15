const messengerService = require('../services/messenger');

/**
 * messenger Socket.io 이벤트 핸들러 등록.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
module.exports = (socket, io) => {
    const userId = socket.user.id;

    // ----------------------------------------------------------
    // message:send — 메시지 전송
    // ----------------------------------------------------------
    socket.on('message:send', async (data) => {
        try {
            const { room_id, content, media_url } = data || {};

            if (!room_id || typeof room_id !== 'string') {
                return socket.emit('message:error', { code: 'INVALID_DATA', message: '잘못된 요청입니다.' });
            }

            if (!content && !media_url) {
                return socket.emit('message:error', { code: 'EMPTY_MESSAGE', message: '빈 메시지는 보낼 수 없습니다.' });
            }

            const message = await messengerService.sendMessage({
                roomId: room_id,
                senderId: userId,
                content: content || null,
                mediaUrl: media_url || null
            });

            // 같은 채팅방 전원에게 emit
            io.to(`room:${room_id}`).emit('message:receive', {
                id: String(message.id),
                room_id: message.room_id,
                sender_id: message.sender_id,
                content: message.content,
                media_url: message.media_url,
                created_at: message.created_at
            });
        } catch (err) {
            socket.emit('message:error', {
                code: err.code || 'INTERNAL_ERROR',
                message: err.message || '서버 오류가 발생했습니다.'
            });
        }
    });

    // ----------------------------------------------------------
    // message:read — 읽음 처리
    // ----------------------------------------------------------
    socket.on('message:read', async (data) => {
        try {
            const { room_id, last_message_id } = data || {};

            if (!room_id || typeof room_id !== 'string') {
                return socket.emit('message:error', { code: 'INVALID_DATA', message: '잘못된 요청입니다.' });
            }

            const parsedId = Number(last_message_id);
            if (last_message_id == null || Number.isNaN(parsedId) || parsedId < 0) {
                return socket.emit('message:error', { code: 'INVALID_DATA', message: '잘못된 요청입니다.' });
            }

            await messengerService.markRead({
                roomId: room_id,
                userId,
                lastMessageId: parsedId
            });

            // 같은 채팅방의 다른 멤버에게 emit (본인 제외)
            socket.to(`room:${room_id}`).emit('message:read:update', {
                room_id,
                user_id: userId,
                last_read_message_id: parsedId
            });
        } catch (err) {
            socket.emit('message:error', {
                code: err.code || 'INTERNAL_ERROR',
                message: err.message || '서버 오류가 발생했습니다.'
            });
        }
    });
};
