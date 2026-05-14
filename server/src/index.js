// ====================
// setting
// ====================

require('dotenv').config();

const path = require('path');
const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./middlewares/errorHandler');

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

// --- notification


//------------------------------
// Error Handler (마지막)

app.use(errorHandler);

app.listen(process.env.NODE_PORT, () => {
    console.log("node server start!");
});