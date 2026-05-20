# DevChat

[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

**DevChat** 은 페이스북 형식의 SNS 와 페이스북 메신저 형식의 실시간 채팅을 한 서비스로 통합한 학습용 풀스택 웹 애플리케이션입니다. 게시글·댓글·좋아요·친구 관계 같은 SNS 핵심 기능과, Socket.io 기반 실시간 1:1 / 그룹 채팅, 그리고 사용자 활동을 추적하는 알림 시스템을 하나의 일관된 아키텍처 위에 구현했습니다. JWT + HttpOnly 쿠키 기반 인증, 이메일 인증 가입 흐름, 계층 분리(Controller / Service / Repository) 백엔드 구조, PostgreSQL 의 CASCADE 제약과 ENUM 타입을 적극 활용한 데이터 모델링을 통해 실제 서비스 수준의 설계 원칙을 적용하는 것을 목표로 합니다.

---

## Web Image

### signup
<img width="601" height="780" alt="Image" src="https://github.com/user-attachments/assets/a840f15d-594b-4b57-911d-3633b3a844a5" />

### login
<img width="604" height="606" alt="Image" src="https://github.com/user-attachments/assets/d6f58105-7605-4220-8f31-67c0bdf6e327" />

### profile_update
<img width="535" height="923" alt="image" src="https://github.com/user-attachments/assets/0dcc5e3f-09d2-429a-9ee9-96be466be647" />

### main page (friend feed and my feed)
<img width="1128" height="946" alt="Image" src="https://github.com/user-attachments/assets/44c4339a-636c-4bff-a790-10bd89592c7d" />

### random feed
<img width="1096" height="943" alt="image" src="https://github.com/user-attachments/assets/632e22ca-47cf-481e-ad75-9c6a1525b1c0" />

### user feed (Detailed inquiry)
<img width="713" height="928" alt="image" src="https://github.com/user-attachments/assets/e43d67b5-ef1f-422c-82d6-7ffaeed020a7" />

### messenger
<img width="1917" height="946" alt="image" src="https://github.com/user-attachments/assets/e9b6382f-09f7-4fa8-9297-2b230142b389" />

### friend search
<img width="713" height="904" alt="image" src="https://github.com/user-attachments/assets/cdaa8dee-9bf9-475b-8a64-0ee3960f0fbb" />

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [디렉토리 구조](#디렉토리-구조)
- [시작하기](#시작하기)
- [API 개요](#api-개요)
- [Socket.io 이벤트](#socketio-이벤트)
- [보안 설계](#보안-설계)
- [License](#license)

---

## 주요 기능

총 **5개 영역 / 31개 기능** 으로 구성됩니다.

### Auth — 인증 / 계정 관리
- 이메일 인증 코드 발송 (회원가입 1단계, 60초 쿨다운)
- 이메일 인증 코드 검증 + 계정 생성 + 자동 로그인 (회원가입 2단계)
- 로그인 / 로그아웃
- JWT Access(1h) + Refresh(14d) 토큰 자동 재발급
- 내 프로필 조회 / 편집 (프로필 이미지 업로드 포함)
- 공개 프로필 조회
- 회원 탈퇴 (CASCADE 로 관련 데이터 정리)

### Friend — 친구 관계
- 사용자 검색 (handle 기반)
- 친구 신청 / 수락 / 거절 / 취소 / 끊기
- 친구 목록 조회
- 보낸 / 받은 친구 신청 목록

### Feed — 게시글 / 댓글 / 좋아요
- 게시글 작성 / 수정 / 삭제 (최대 5장 미디어 첨부)
- 뉴스피드 조회 (본인 + accepted 친구의 게시글)
- 탐색 피드 (본인 제외 무작위 게시글)
- 프로필 피드 (특정 유저의 게시글)
- 댓글 작성 / 삭제 (`parent_id` 로 대댓글 계층 지원)
- 좋아요 / 좋아요 취소 (`UNIQUE(post_id, user_id)` 로 중복 방지)

### Messenger — 실시간 채팅
- 1:1 채팅방 생성 (`direct_key` 로 중복 방지)
- 그룹 채팅방 생성 / 이름 변경 / 멤버 초대
- 채팅방 목록 / 멤버 목록 조회
- 실시간 메시지 송수신 (Socket.io)
- 메시지 내역 조회 (페이지네이션)
- 채팅 이미지 업로드
- 메시지 삭제 (soft delete)
- 메시지 읽음 표시 실시간 동기화
- 채팅방 나가기

### Notification — 알림
- 알림 목록 조회 (친구 신청 / 수락, 좋아요, 댓글, 대댓글, 채팅 초대 등 6종)
- 개별 / 전체 읽음 처리
- 알림 삭제
- 부분 인덱스(`WHERE is_read = FALSE`) 로 미읽음 카운트 최적화

---

## 기술 스택

### Frontend

| 항목 | 사용 기술 |
|---|---|
| Framework | React 19 (functional + hooks) |
| Routing | react-router-dom v7 |
| HTTP Client | axios (`withCredentials: true`) |
| Real-time | socket.io-client |
| Styling | CSS Module (`*.module.css`) |
| State | useState / useReducer / Context (Redux 미사용) |
| Build | Create React App (react-scripts 5) |

### Backend

| 항목 | 사용 기술 |
|---|---|
| Runtime | Node.js + Express 5 |
| Real-time | Socket.io 4 |
| Auth | JWT (jsonwebtoken) + HttpOnly Cookie |
| Password | bcrypt |
| File Upload | multer |
| Mailer | nodemailer (SMTP) |
| Env | dotenv |

### Database

| 항목 | 사용 기술 |
|---|---|
| RDBMS | PostgreSQL 15+ |
| Driver | pg (node-postgres) |
| 특징 | UUID + BIGSERIAL 혼합 PK, ENUM 타입 3종, `ON DELETE CASCADE`, 부분 인덱스, JSONB |

### Infra / Tooling

| 항목 | 사용 기술 |
|---|---|
| Dev Server (FE) | react-scripts dev server (port 3000) |
| Dev Server (BE) | Node.js (port 5000) |
| CORS | cors + credentials |
| Static Files | `/uploads` 디렉토리 정적 서빙 |

---

## 아키텍처

DevChat 백엔드는 **Single Responsibility** 를 따른 4계층 구조이며, 각 계층은 본인 책임만 수행합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client (React)                        │
│  pages → components → hooks/contexts → services (axios)     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + Cookie (HttpOnly)
                         │ WebSocket (Socket.io)
┌────────────────────────▼────────────────────────────────────┐
│                   Express App / Socket.io                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Routes        (URL → Controller)                     │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Middlewares   (authenticate, upload, errorHandler)   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Controllers   (HTTP I/O, 형식 검증, res.json)         │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Services      (비즈니스 로직 + 비즈니스 검증)            │  │
│  │                실패는 boolean 이 아닌 AppError throw    │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │  Repositories  (DB 쿼리만 — parameterized)             │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │ pg pool
┌───────────────────────────▼─────────────────────────────────┐
│              PostgreSQL  (10 tables, 3 ENUMs)               │
│  users · friendships · posts · posts_media · comments       │
│  likes · chat_rooms · messages · room_members · notifications│
└─────────────────────────────────────────────────────────────┘
```

### 계층별 책임

| 계층 | 책임 | 금지 |
|---|---|---|
| **Controller** | HTTP 처리, 형식 검증, Service 호출, 응답 작성 | DB 쿼리 |
| **Service** | 비즈니스 로직, 비즈니스 검증, `AppError` throw | `res` / `res.json` 사용 |
| **Repository** | DB 쿼리(parameterized)만 | 비즈니스 로직 |
| **Middleware** | 횡단 관심사 (인증, 업로드, 에러 변환) | 도메인 로직 |

### 에러 처리: throw + globalHandler 패턴

```js
// Service — 실패는 throw
throw new ConflictError('HANDLE_TAKEN', '현재 사용중인 ID입니다.');

// Controller — try/catch → next(err)
try {
  const result = await authService.signup(req.body);
  res.status(201).json({ data: result });
} catch (err) { next(err); }

// errorHandler — AppError.statusCode 기반 HTTP 변환
// → { error: { code, message } }
```

### 응답 envelope

```json
// 성공
{ "data": { ... } }

// 실패
{ "error": { "code": "HANDLE_TAKEN", "message": "현재 사용중인 ID입니다." } }
```

---

## 디렉토리 구조

```
projectDevChat/
├── client/                          # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── api/                     # axios 기반 API 호출 함수
│   │   │   ├── axios.js             # 인스턴스 + interceptor (자동 재발급)
│   │   │   ├── auth.js
│   │   │   ├── friend.js
│   │   │   ├── feed.js
│   │   │   ├── messenger.js
│   │   │   └── user.js
│   │   ├── components/
│   │   │   └── feature/             # 도메인 컴포넌트 (PostCard, CommentSection 등)
│   │   ├── contexts/                # AuthContext, SocketContext, UnreadContext
│   │   ├── pages/                   # 라우트 단위 페이지
│   │   │   ├── auth/                # Login, Signup, Profile
│   │   │   ├── messenger/           # Messenger, ChatRoom, NewChatModal
│   │   │   ├── Home.jsx
│   │   │   ├── Friends.jsx
│   │   │   └── UserProfile.jsx
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── server/                          # Express 백엔드
│   ├── src/
│   │   ├── app.js / index.js        # 앱 부트스트랩 (Express + Socket.io)
│   │   ├── routes/                  # URL → Controller 매핑
│   │   │   ├── auth.js
│   │   │   ├── friend.js
│   │   │   ├── feed.js · posts.js · comments.js
│   │   │   ├── messenger.js
│   │   │   ├── users.js
│   │   │   └── notification.js
│   │   ├── controllers/             # HTTP 처리 + 형식 검증
│   │   ├── services/                # 비즈니스 로직
│   │   │   ├── auth.js · mailer.js · storage.js
│   │   │   ├── feed.js · friend.js
│   │   │   ├── messenger.js · notification.js
│   │   ├── repositories/            # DB 쿼리
│   │   │   ├── user.js · emailVerification.js
│   │   │   ├── friendship.js · feed.js
│   │   │   ├── messenger.js · notification.js
│   │   ├── middlewares/             # authenticate, upload, errorHandler
│   │   ├── errors/                  # AppError 클래스
│   │   ├── sockets/                 # Socket.io 핸들러
│   │   │   ├── index.js             # 인증 미들웨어 + 부트스트랩
│   │   │   └── messenger.js         # message:send / message:read 이벤트
│   │   └── db/
│   │       └── db.js                # pg pool
│   ├── uploads/                     # 업로드된 파일 (정적 서빙)
│   ├── .env
│   └── package.json
│
├── .claude/
│   ├── agents/                      # Sub-agent 정의 (6개)
│   └── document/                    # 명세 문서 (기능/API/DB)
├── CLAUDE.md                        # 프로젝트 컨벤션 가이드
└── README.md
```

---

## 시작하기

### 사전 요구사항

- **Node.js** 18 이상
- **PostgreSQL** 15 이상
- **npm** (또는 yarn)
- **SMTP 계정** — 이메일 인증 발송용 (Gmail 앱 비밀번호 권장)

### 1. 저장소 클론

```bash
git clone https://github.com/Parkseojin08/DevChat.git
cd DevChat
```

### 2. PostgreSQL 데이터베이스 준비

```sql
-- psql 또는 pgAdmin 등에서
CREATE DATABASE devchat;
```

이후 `.claude/document/DB테이블정리.md` 에 정의된 10개 테이블과 3개 ENUM 타입을 순서대로 생성합니다.

- ENUM: `friend_status`, `room_type_status`, `notification_type`
- 테이블: `users` → `friendships` → `posts` → `posts_media` → `comments` → `likes` → `chat_rooms` → `messages` → `room_members` → `notifications`
- 추가 인덱스: `idx_notifications_user_recent`, `idx_notifications_user_unread` (부분 인덱스)

> 이메일 인증을 위해 `email_verifications` 테이블 (email, code, payload(JSONB), expires_at, attempts) 도 함께 생성합니다.

### 3. 환경 변수 설정

`server/.env` 파일을 생성하고 아래 변수를 채웁니다.

```env
# Node.js / Front URL
NODE_ENV=development
NODE_PORT=5000
FRONT_URL=http://localhost:3000

# PostgreSQL
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=devchat
PG_PASSWORD=your_password
PG_PORT=5432

# JWT
JWT_SECRET=replace_with_strong_random_string
JWT_REFRESH_SECRET=replace_with_another_strong_random_string

# SMTP (이메일 인증)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM_NAME=DevChat
```

> **주의** — `.env` 는 절대 커밋하지 마세요. `.gitignore` 에 포함되어야 합니다.
> Gmail 사용 시: Google 계정 → 2단계 인증 활성화 → 앱 비밀번호 생성 후 `SMTP_PASS` 에 입력.

### 4. 의존성 설치 & 실행

```bash
# Backend
cd server
npm install
npm start                 # http://localhost:5000

# Frontend (별도 터미널)
cd client
npm install
npm start                 # http://localhost:3000
```

브라우저에서 `http://localhost:3000` 으로 접속.

### 5. 빌드 (프로덕션)

```bash
cd client
npm run build             # client/build/ 생성
```

---

## API 개요

전체 명세는 `.claude/document/API 명세서 *.md` 및 `.claude/document/add_function.md` 를 참조하세요. 아래는 주요 엔드포인트 요약입니다.

### Auth — `/auth`

| Method | Path | Auth | 설명 |
|---|---|---|---|
| POST | `/auth/email/send-code` | – | 회원가입 1단계: 이메일 인증 코드 발송 |
| POST | `/auth/email/verify` | – | 회원가입 2단계: 코드 검증 + 계정 생성 + 자동 로그인 |
| POST | `/auth/signup` | – | 레거시: 이메일 인증 없이 즉시 가입 |
| POST | `/auth/login` | – | 로그인 (쿠키 발급) |
| POST | `/auth/logout` | required | 로그아웃 (쿠키 제거 + refresh token 무효화) |
| POST | `/auth/refresh` | refresh cookie | Access token 재발급 (회전) |
| GET | `/auth/me` | required | 내 프로필 조회 |
| PATCH | `/auth/me` | required | 프로필 편집 (이미지 포함) |
| DELETE | `/auth/me` | required | 회원 탈퇴 |

### Friend — `/friendships`

| Method | Path | 설명 |
|---|---|---|
| GET | `/friendships/search?q=handle` | 사용자 검색 |
| GET | `/friendships` | 친구 목록 / 보낸·받은 신청 목록 |
| POST | `/friendships` | 친구 신청 (pending 생성) |
| PATCH | `/friendships/:id` | 친구 수락 (pending → accepted) |
| DELETE | `/friendships/:id` | 거절 / 신청 취소 / 친구 끊기 |

### Feed — `/posts`, `/comments`, `/feed`

| Method | Path | 설명 |
|---|---|---|
| GET | `/feed` | 뉴스피드 (본인 + 친구) |
| GET | `/feed/explore` | 탐색 피드 (무작위) |
| POST | `/posts` | 게시글 작성 (최대 5장 미디어) |
| PATCH | `/posts/:id` | 게시글 수정 |
| DELETE | `/posts/:id` | 게시글 삭제 |
| GET | `/posts/user/:userId` | 특정 유저의 게시글 |
| GET | `/posts/:postId/comments` | 댓글 목록 |
| POST | `/posts/:postId/comments` | 댓글 작성 |
| DELETE | `/comments/:id` | 댓글 삭제 |
| POST | `/posts/:postId/likes` | 좋아요 |
| DELETE | `/posts/:postId/likes` | 좋아요 취소 |

### Messenger — `/chat-rooms`, `/messages`

| Method | Path | 설명 |
|---|---|---|
| POST | `/chat-rooms` | 채팅방 생성 (direct / group) |
| GET | `/chat-rooms` | 내 채팅방 목록 |
| GET | `/chat-rooms/:id/messages` | 메시지 내역 |
| POST | `/chat-rooms/:id/messages/upload` | 채팅 이미지 업로드 |
| PATCH | `/chat-rooms/:id` | 채팅방 이름 변경 (group 만) |
| GET | `/chat-rooms/:id/members` | 멤버 목록 |
| POST | `/chat-rooms/:id/members` | 멤버 초대 |
| DELETE | `/chat-rooms/:id/members/me` | 채팅방 나가기 |
| DELETE | `/messages/:id` | 메시지 삭제 (soft) |

### User / Notification

| Method | Path | 설명 |
|---|---|---|
| GET | `/users/:id` | 공개 프로필 조회 |
| GET | `/notifications` | 알림 목록 |
| PATCH | `/notifications/read-all` | 전체 읽음 처리 |
| PATCH | `/notifications/:id` | 개별 읽음 처리 |
| DELETE | `/notifications/:id` | 알림 삭제 |

---

## Socket.io 이벤트

Socket.io 는 쿠키의 `accessToken` 으로 인증되며, 연결 시 사용자가 속한 모든 채팅방의 `room:{roomId}` 에 자동 join 됩니다.

### Client → Server

| Event | Payload | 설명 |
|---|---|---|
| `message:send` | `{ room_id, content, media_url }` | 메시지 전송 — 같은 방 전원에게 `message:receive` emit |
| `message:read` | `{ room_id, last_message_id }` | 읽음 표시 — 같은 방의 다른 멤버에게 `message:read:update` emit |

### Server → Client

| Event | Payload | 설명 |
|---|---|---|
| `message:receive` | `{ id, room_id, sender_id, content, media_url, created_at }` | 새 메시지 수신 |
| `message:read:update` | `{ room_id, user_id, last_read_message_id }` | 다른 멤버의 읽음 상태 갱신 |
| `message:error` | `{ code, message }` | 전송·읽음 처리 실패 |

---

## 보안 설계

| 항목 | 적용 |
|---|---|
| **비밀번호** | bcrypt 해시 저장. 평문·응답 노출 절대 금지 |
| **토큰 저장소** | `localStorage` 미사용 → **HttpOnly Cookie** (XSS 방어) |
| **토큰 구조** | Access(1h) + Refresh(14d), refresh token **회전** |
| **CSRF 방어** | `sameSite: lax` 쿠키 옵션 |
| **CORS** | `FRONT_URL` 화이트리스트 + `credentials: true` |
| **SQL Injection** | 전 쿼리 parameterized (`$1, $2 …`) |
| **User Enumeration** | 미가입 이메일과 비밀번호 불일치를 동일 에러로 응답 |
| **이메일 인증** | 6자리 코드 + 10분 만료 + 5회 시도 제한 + 60초 재발송 쿨다운 |
| **권한 검증** | 모든 비-공개 라우트 `authenticate` 미들웨어 통과 + Service 단에서 소유권/멤버십 재검증 |
| **CASCADE** | 회원 탈퇴 시 작성한 모든 데이터 자동 정리 |
| **시크릿** | 하드코딩 금지 → `.env` 로 분리 |
| **파일 업로드** | `multer` 로 타입·크기 제한, `uploads/` 디렉토리만 정적 서빙 |

---

## License

This project is licensed under the **MIT License**. See below.

```
MIT License

Copyright (c) 2026 DevChat Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
