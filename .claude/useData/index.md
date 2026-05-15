# DevChat 사용 npm 라이브러리

DevChat에서 **실제로 직접 import해서 쓰고 있는** 라이브러리만 정리.
CRA 내장(`react-scripts`)·테스트 도구(`@testing-library/*`)·`web-vitals`는 제외.

> 깊은 설계 가이드가 필요한 라이브러리는 별도 파일로 둠 — 현재 `multer.md` 존재.

---

## 1. 서버 (server/package.json)

| 라이브러리 | 버전 | 한 줄 정리 | 주 사용처 |
|---|---|---|---|
| `express` | ^5.2.1 | HTTP 서버 + 라우팅 + 미들웨어 체인 | [server/src/index.js](server/src/index.js), `routes/*` |
| `socket.io` | ^4.8.3 | 실시간 양방향 통신 (메신저) | [server/src/index.js](server/src/index.js), `sockets/*` |
| `pg` | ^8.20.0 | PostgreSQL 클라이언트 (`Pool`) | [server/src/db/db.js](server/src/db/db.js) |
| `jsonwebtoken` | ^9.0.3 | JWT 발급/검증 (access 1h, refresh 14d) | `services/auth.js`, `middlewares/authenticate.js`, `sockets/index.js` |
| `bcrypt` | ^6.0.0 | 비밀번호 해싱 (saltRounds=10) | `services/auth.js` |
| `cookie-parser` | ^1.4.7 | HttpOnly 쿠키(accessToken/refreshToken) 파싱 | `index.js`, 모든 인증 미들웨어 |
| `cors` | ^2.8.6 | `FRONT_URL` 허용 + `credentials: true` | `index.js` |
| `dotenv` | ^17.4.2 | `.env` 환경 변수 로드 | `index.js` 최상단 |
| `multer` | ^2.1.1 | `multipart/form-data` 파싱 (프로필 이미지) | `middlewares/upload.js` → **상세: [multer.md](multer.md)** |

### 1-1. `express` — HTTP 핵심
- Express **5.x** 사용 → async 라우터의 throw가 자동으로 `next(err)` 전달.
- 미들웨어 순서(`index.js`):
  ```
  express.json() → cookieParser() → cors() → /uploads 정적 → routes → errorHandler
  ```
- 라우트는 도메인별로 분리: `/auth`, `/friendships`, `/posts`, `/comments`, `/feed`, `/chat-rooms`, `/messages`.
- 모든 에러는 한 곳(`middlewares/errorHandler.js`)에서 envelope로 변환.

### 1-2. `socket.io` — 실시간 메신저
- `http.createServer(app)` 위에 `new Server(...)`로 부착.
- CORS는 Express의 cors와 별개로 socket.io 옵션에 따로 설정 (`origin: FRONT_URL`, `credentials: true`).
- `app.set('io', io)`로 컨트롤러에서도 `req.app.get('io')`로 접근 가능 (HTTP 액션 후 socket emit 용도).
- 인증 미들웨어(`io.use`)에서 쿠키 파싱 → JWT 검증 → `socket.user = decoded`.
- 연결 시 사용자가 속한 모든 채팅방의 socket.io room에 자동 join (`socket.join('room:'+roomId)`).
- 도메인별 핸들러는 `sockets/messenger.js` 같은 파일로 분리.

### 1-3. `pg` — DB
- `Pool` 단일 인스턴스 (`db/db.js`)를 모든 repository에서 공유.
- 환경 변수: `PG_USER`, `PG_HOST`, `PG_DATABASE`, `PG_PASSWORD`, `PG_PORT`, `PG_OPTIONS`.
- 모든 쿼리는 **parameterized**(`$1, $2, ...`), schema prefix `chatdata.` 필수.

### 1-4. `jsonwebtoken` — JWT
- 비밀키 분리: `JWT_SECRET`(access), `JWT_REFRESH_SECRET`(refresh).
- 토큰 만료 시 `TokenExpiredError` → `UnauthorizedError('TOKEN_EXPIRED', ...)`로 변환.
- 서명 오류(검증 실패) → `INVALID_TOKEN`.
- Socket.io 인증에서도 같은 `JWT_SECRET`으로 access token 검증.

### 1-5. `bcrypt` — 비밀번호
- saltRounds **10** (CPU 부하와 보안의 균형점).
- `bcrypt.hash(password, 10)` → DB의 `password_hash`.
- 로그인 시 `bcrypt.compare(password, hash)`.
- 응답에 `password` / `password_hash` 절대 노출 X (repository에서 SELECT 시 제외).

### 1-6. `cookie-parser` — 쿠키
- 모든 토큰은 HttpOnly 쿠키로만 주고받음 (localStorage 미사용).
- 로그인 응답 시 `res.cookie('accessToken', ...)`, `res.cookie('refreshToken', ...)` (HttpOnly + sameSite=lax + secure(prod)).
- 미들웨어에서 `req.cookies.accessToken`으로 추출.
- Socket.io 측에서는 `cookie.parse(socket.handshake.headers.cookie)`로 직접 파싱 (cookie-parser는 Express용).

### 1-7. `cors`
- `origin: process.env.FRONT_URL` — `*` 금지.
- `credentials: true` — 쿠키 동반 요청 허용.

### 1-8. `dotenv`
- `index.js` **최상단**에서 `require('dotenv').config()` (다른 모듈이 환경 변수 읽기 전).
- `.env`는 `.gitignore`에 포함, 절대 commit X.

### 1-9. `multer`
- 프로필 이미지 업로드 (`profile_image` 필드).
- **memoryStorage** 채택 → 디스크 저장은 `services/storage.js`가 일원화 담당.
- 자세한 설계 결정 / 흐름 / 에러 변환 래퍼는 **[multer.md](multer.md)** 참조.

---

## 2. 클라이언트 (client/package.json)

| 라이브러리 | 버전 | 한 줄 정리 | 주 사용처 |
|---|---|---|---|
| `react` | ^19.2.6 | UI 함수형 컴포넌트 + Hooks | 전체 |
| `react-dom` | ^19.2.6 | DOM 렌더러 (`createRoot`) | `index.js` |
| `react-router-dom` | ^7.15.0 | SPA 라우팅 (BrowserRouter, Routes, Route, Navigate) | [client/src/App.js](client/src/App.js) |
| `axios` | ^1.16.0 | HTTP 클라이언트 + 인터셉터(토큰 자동 재발급) | [client/src/api/axios.js](client/src/api/axios.js) |

### 2-1. `react` / `react-dom` — 19.x
- 함수형 + Hooks 전용 (class component 미사용).
- Context는 글로벌 상태(인증·소켓)에만, 그 외는 `useState`/`useReducer`.
- Redux 미사용 — 본 프로젝트 범위엔 과함.

### 2-2. `react-router-dom` — v7
- `BrowserRouter`로 감싸고 `Routes`/`Route`로 트리 구성.
- 보호 라우트는 자체 컴포넌트(`PrivateRoute`)로: `authChecked` 대기 → user 없으면 `/login`으로 `Navigate`.
- 로그인된 사용자가 `/login`, `/signup`에 접근하면 `PublicOnlyRoute`로 홈 리다이렉트.
- 매칭 안 되는 경로 → `<Navigate to="/" replace />`로 폴백.

### 2-3. `axios`
- 단일 인스턴스(`api/axios.js`)로 모든 호출 통합.
- 핵심 옵션:
  - `withCredentials: true` — 쿠키 자동 동반 (없으면 인증 깨짐).
  - `baseURL: '/'` — CRA의 `proxy: http://localhost:5000` 설정으로 dev 시 백엔드로 프록시.
- **응답 인터셉터** — 401 + `TOKEN_EXPIRED` 자동 처리:
  1. 한 번만 재시도(`_retried` 플래그) → 무한 루프 방지.
  2. `/auth/refresh` 호출로 새 access token 발급.
  3. 원래 요청 재실행. 실패 시 `/login`으로 강제 이동.
  4. `/auth/refresh` 자체 401은 재시도에서 제외.
- 컴포넌트는 axios를 직접 import하지 않고, 도메인별 API 모듈(`api/*.js`)을 통과시키는 것을 원칙으로 함.

---

## 3. 환경 변수 요약 (라이브러리와 직접 연관)

| 변수 | 사용 라이브러리 |
|---|---|
| `NODE_PORT` | express (listen) |
| `FRONT_URL` | cors, socket.io |
| `JWT_SECRET` | jsonwebtoken (access) |
| `JWT_REFRESH_SECRET` | jsonwebtoken (refresh) |
| `PG_USER`/`PG_HOST`/`PG_DATABASE`/`PG_PASSWORD`/`PG_PORT`/`PG_OPTIONS` | pg |

---

## 4. 일부러 안 쓰는 라이브러리 (의도된 선택)

| 후보 | 안 쓰는 이유 |
|---|---|
| `zod` / `joi` | 현재는 정규식·수동 검증으로 충분. 검증량 늘면 도입 고려. |
| `helmet` | 학습 단계에선 미적용. 운영 전환 시 추가 권장. |
| `express-rate-limit` | 학습 단계 — 운영 전 brute-force 방어용으로 도입 권장. |
| `redux` / `zustand` | 글로벌 상태가 인증·소켓 정도라 Context로 충분. |
| `swr` / `@tanstack/react-query` | 서버 상태 캐싱이 아직 단순. 무한스크롤·캐시 필요해지면 도입 고려. |
