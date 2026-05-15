const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const messengerSocket = require('./messenger');
const messengerRepo = require('../repositories/messenger');

/**
 * Socket.io 부트스트랩.
 * io 인스턴스를 받아 인증 미들웨어 + 이벤트 핸들러를 등록한다.
 *
 * @param {import('socket.io').Server} io
 */
module.exports = (io) => {
    // ----------------------------------------------------------
    // 인증 미들웨어: 쿠키에서 accessToken 추출 → JWT 검증
    // ----------------------------------------------------------
    io.use((socket, next) => {
        try {
            const rawCookie = socket.handshake.headers.cookie || '';
            const cookies = cookie.parse(rawCookie);
            const token = cookies.accessToken;

            if (!token) {
                return next(new Error('UNAUTHENTICATED'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('INVALID_TOKEN'));
        }
    });

    // ----------------------------------------------------------
    // connection 핸들러
    // ----------------------------------------------------------
    io.on('connection', async (socket) => {
        const userId = socket.user.id;

        // 사용자가 속한 모든 채팅방의 Socket.io room에 join
        try {
            const rooms = await messengerRepo.findRoomsByUserId(userId);
            for (const room of rooms) {
                socket.join(`room:${room.id}`);
            }
        } catch (err) {
            console.error('Socket room join error:', err.message);
        }

        // messenger 이벤트 핸들러 등록
        messengerSocket(socket, io);

        socket.on('disconnect', () => {
            // 별도 정리 필요 없음 — socket.io가 자동으로 room에서 제거
        });
    });
};
