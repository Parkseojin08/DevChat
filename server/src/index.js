// ====================
// setting
// ====================

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const server = http.createServer(app);

// Socket.io 서버 생성
const io = new Server(server, {
    cors: {
        origin: process.env.FRONT_URL,
        credentials: true
    }
});

// io 인스턴스를 컨트롤러에서 접근 가능하게 등록
app.set('io', io);

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.FRONT_URL, credentials: true }));

// 업로드된 파일 정적 서빙 — uploads/ 디렉토리만 노출
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ====================
// API
// ====================

// --- auth
app.use('/auth', require('./routes/auth'));

// --- friend
app.use('/friendships', require('./routes/friend'));

// --- feed
app.use('/posts', require('./routes/posts'));
app.use('/comments', require('./routes/comments'));
app.use('/feed', require('./routes/feed'));

// --- messenger
app.use('/chat-rooms', require('./routes/messenger'));

// DELETE /messages/:id — 메시지 삭제 (별도 prefix)
const messengerCtrl = require('./controllers/messenger');
const { authenticate } = require('./middlewares/authenticate');
app.delete('/messages/:id', authenticate, messengerCtrl.deleteMessage);

// --- users (공개 프로필)
app.use('/users', require('./routes/users'));

// --- notification


//------------------------------
// Error Handler (마지막)

app.use(errorHandler);

// ====================
// Socket.io 부트스트랩
// ====================

require('./sockets')(io);

// ====================
// 서버 시작
// ====================

server.listen(process.env.NODE_PORT, () => {
    console.log("node server start!");
});
