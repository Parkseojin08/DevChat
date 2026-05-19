const express = require('express');
const routes = express.Router();
const controllers = require('../controllers/auth.js');
const { authenticate } = require('../middlewares/authenticate');
const { upload, wrapUpload } = require('../middlewares/upload');

// profile_image 파일 필드(선택) 단일 업로드 미들웨어
const uploadProfileImage = wrapUpload(upload.single('profile_image'));

// 회원가입 (multipart/form-data) — 레거시: 이메일 인증 없이 즉시 생성
// 신규 흐름은 /auth/email/send-code → /auth/email/verify 를 사용
routes.post('/signup', uploadProfileImage, controllers.signUp);

// 회원가입 1단계: 이메일 인증 코드 발송 (multipart/form-data)
routes.post('/email/send-code', uploadProfileImage, controllers.sendEmailCode);

// 회원가입 2단계: 인증 코드 검증 + 계정 생성 + 자동 로그인 (application/json)
routes.post('/email/verify', controllers.verifyEmailCode);

// 로그인
routes.post('/login', controllers.signIn);

// 로그아웃 (인증 필요)
routes.post('/logout', authenticate, controllers.logOut);

// 토큰 재발급
routes.post('/refresh', controllers.refresh);

// 내 프로필 조회 (인증 필요)
routes.get('/me', authenticate, controllers.getProfile);

// 프로필 편집 (인증 필요, multipart/form-data)
routes.patch('/me', authenticate, uploadProfileImage, controllers.profileUpdate);

// 회원 탈퇴 (인증 필요)
routes.delete('/me', authenticate, controllers.profileDelete);

module.exports = routes;