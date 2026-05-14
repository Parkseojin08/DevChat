# DevChat 프로젝트

페이스북 + 페이스북 메신저를 한 서비스로 통합한 **SNS + 실시간 채팅 웹 서비스**.

## 프로젝트 개요

- **목적**: 학습 프로젝트. 통합형 SNS·메신저 아키텍처 구현 경험
- **범위**: 31개 기능 / 5개 영역 (Auth, Friend, Feed, Messenger, Notification)
- **DB**: 10개 테이블 (PostgreSQL)
- **참조 문서**: Notion 워크스페이스의 `project: DevChat` 페이지 및 하위 페이지들

## 기술 스택

### Backend
- **Runtime**: Node.js + Express
- **Real-time**: Socket.io
- **Database**: PostgreSQL
- **Auth**: JWT (access 1h + refresh 14d) with refresh token 회전, **HttpOnly 쿠키**
- **Password**: bcrypt

### Frontend
- **Framework**: React (functional + hooks)
- **Styling**: CSS Module (`*.module.css`)
- **HTTP**: axios (`withCredentials: true` 필수)
- **Real-time**: socket.io-client
- **Routing**: react-router v6+
- **State**: useState / useReducer / Context (Redux 미사용)

## 아키텍처: 계층 분리 (Single Responsibility)

### Backend 디렉토리 구조

```
src/
├── app.js
├── routes/             # Express 라우터
├── controllers/        # HTTP 처리 + 형식 검증
├── services/           # 비즈니스 로직 + 비즈니스 검증
├── repositories/       # DB 쿼리
├── middlewares/        # authenticate, errorHandler
├── errors/             # AppError 클래스
└── sockets/            # Socket.io 핸들러
```

### Frontend 디렉토리 구조

```
src/
├── pages/              # 라우트 단위 페이지
├── components/
│   ├── ui/             # 재사용 (Button, Input)
│   └── feature/        # 도메인 (PostCard, MessageBubble)
├── services/           # API 호출 함수
├── hooks/              # 커스텀 훅
├── contexts/           # AuthContext, SocketContext
└── styles/             # reset.css만
```

## 핵심 컨벤션

### 1. 계층별 책임 (절대 섞지 말 것)

| 계층 | 책임 | 금지 |
|---|---|---|
| Controller | HTTP 처리, 형식 검증, service 호출, 응답 | DB 쿼리 |
| Service | 비즈니스 로직, 비즈니스 검증, AppError throw | res/res.json 사용 |
| Repository | DB 쿼리만 | 비즈니스 로직 |

### 2. 에러 처리: 커스텀 에러 + throw 패턴

```js
// Service는 boolean을 반환하지 않음. 실패는 throw.
throw new ConflictError('HANDLE_TAKEN', '현재 사용중인 ID입니다.');

// Controller는 try/catch + next(err)
try {
  const result = await authService.signup(req.body);
  res.status(201).json({ data: result });
} catch (err) { next(err); }

// Global error handler가 statusCode 보고 HTTP 응답 변환
```

### 3. 검증 단계 분리

- **Controller**:  이메일 형식, 길이, 필수 필드 → 400
- **Service**: 비즈니스 검증 (DB 체크) — 중복, 존재, 권한 → 409/404/403

### 4. 인증

- 미들웨어는 access token만 검증 (refresh 모름)
- 토큰 재발급은 별도 `/auth/refresh` 엔드포인트
- 자동 재발급은 프론트엔드 axios interceptor가 담당
- 모든 토큰은 HttpOnly 쿠키 (XSS 방어)

### 5. 응답 형식

```json
// 성공
{ "data": { ... } }

// 실패
{ "error": { "code": "HANDLE_TAKEN", "message": "현재 사용중인 ID입니다." } }
```

- `message`: 사용자에게 보여줄 한글 메시지
- `code`: 프론트엔드 분기용 영문 코드

### 6. DB

- 거의 모든 FK에 `ON DELETE CASCADE`
- PK 타입 혼합: UUID (users, posts, comments, chat_rooms) / BIGSERIAL (기타)
- ENUM 타입 3종: `friend_status`, `room_type_status`, `notification_type`
- 1:1 채팅방 중복 방지: `chat_rooms.direct_key` (정렬된 두 UUID 조합)
- Soft delete: `messages.is_deleted`
- 부분 인덱스: 미읽음 알림 등 핫쿼리 최적화

## 보안 원칙

- ❌ localStorage에 토큰 저장 (쿠키 방식)
- ❌ 평문 비밀번호 저장 (bcrypt 필수)
- ❌ 응답에 password/password_hash 노출
- ❌ 미가입 이메일 vs 비밀번호 불일치 구분 (user enumeration)
- ❌ 하드코딩된 시크릿 (.env로 분리)
- ❌ SQL injection (parameterized query 사용)
- ✅ CSRF 방어: `sameSite: lax` 또는 CSRF 토큰

## Notion 문서 참조

작업 전 반드시 확인:

| 페이지 | 용도 |
|---|---|
| project: DevChat | 프로젝트 전반 |
| 기능 명세 | 31개 기능 상세 (DB 동작, 흐름, 입출력, 예외) |
| API 명세서 | REST + Socket.io 엔드포인트 명세 |
| DB 테이블 정의 | 10개 테이블 스키마 + ENUM |
| HTTP Status Code 정리 | 상태 코드 가이드 |
| 구현된 기능 | 진행 상황 트래커 |

## Sub-Agent 사용 가이드

`.claude/agents/`에 4개의 전문 sub-agent가 있습니다:

- `backend-developer` — Node.js/Express/Socket.io 구현
- `frontend-developer` — React UI 구현
- `db-specialist` — PostgreSQL 스키마·쿼리·마이그레이션
- `code-reviewer` — 코드 품질·보안·컨벤션 리뷰

작업 성격에 따라 자동으로 적절한 agent에게 위임됨. 명시적 호출도 가능:

```
@backend-developer 회원가입 API 구현해줘
@code-reviewer 방금 작성한 회원가입 코드 리뷰
```

## 개발 워크플로우

새 기능 구현 시:

1. **기능 명세** 확인 (사용자 흐름, DB 동작, 예외)
2. **API 명세서** 확인 (엔드포인트, request/response)
3. **DB 테이블 정의** 확인 (스키마, 인덱스, CASCADE)
4. Backend 구현 순서: repository → service → controller → route
5. Frontend 구현 순서: service (API 함수) → component → page → routing
6. **code-reviewer**로 점검
7. **구현된 기능** 페이지에 체크

## 자주 쓰는 명령어

```bash
# Backend
npm run dev              # nodemon으로 개발 서버
npm run migrate          # DB 마이그레이션
npm test                 # 테스트

# Frontend  
npm run dev              # Vite dev server
npm run build            # 프로덕션 빌드
```

(실제 명령어는 프로젝트 셋업 시 package.json 참조)
