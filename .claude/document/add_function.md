# 추가 기능 명세 (API 명세서 미등재)

원본 API 명세서에 포함되지 않은 추가 구현 기능 목록.

---

# 목록

1. [**Auth**](#auth)
2. [**Messenger**](#messenger)
3. [**User**](#user)

---

## Auth

### 이메일 인증 코드 발송

**`POST /auth/email/send-code`**

설명: 회원가입 폼 정보를 검증하고 6자리 인증 코드를 이메일로 발송한다. 계정은 아직 생성되지 않으며, 인증 정보는 `email_verifications` 테이블에 10분간 임시 저장된다. 같은 이메일로 재요청 시 기존 레코드를 덮어쓴다 (UPSERT). 60초 내 재요청은 쿨다운으로 차단한다.

**인증**: 불필요

---

**Request Body** (`multipart/form-data`)

```
handle         string   필수, 3~20자 영문/숫자/_
email          string   필수, 이메일 형식
name           string   필수, 1~50자
password       string   필수, 8자 이상 영문+숫자+특수문자
birth_date     string   필수, YYYY-MM-DD
profile_image  file     선택, 이미지 파일
```

---

**Response 200 OK**

```json
{
  "data": {
    "success": true,
    "message": "인증 코드가 발송되었습니다."
  }
}
```

---

**Response Errors**

| Status | Code | 메시지 | 발생 조건 |
| --- | --- | --- | --- |
| 400 | `INVALID_INPUT` | "입력 형식이 올바르지 않습니다." | 필드 형식 오류 (errors 배열 포함) |
| 400 | `MAIL_SEND_FAILED` | "인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요." | SMTP 전송 실패 |
| 400 | `RESEND_COOLDOWN` | "잠시 후 다시 요청해주세요. (N초 후 가능)" | 60초 이내 재요청 (details.retryAfterSec 포함) |
| 409 | `HANDLE_TAKEN` | "이미 사용 중인 아이디입니다." | handle 중복 |
| 409 | `EMAIL_TAKEN` | "이미 가입된 이메일입니다." | email 중복 |

---

**DB 동작**

```
email_verifications UPSERT — email, code, payload(JSONB), expires_at = NOW()+10min
  payload: { handle, email, name, password_hash, birth_date,
             profile_image_b64, profile_image_mime }
  ※ 평문 password는 저장 안 함 — bcrypt 해시 후 저장
mailer.sendMail → SMTP 전송 실패 시 record DELETE 후 rollback
```

---

**구현 위치**

| 레이어 | 파일 |
| --- | --- |
| Route | `server/src/routes/auth.js` |
| Controller | `server/src/controllers/auth.js` — `exports.sendEmailCode` |
| Service | `server/src/services/auth.js` — `exports.sendEmailVerification` |
| Repository | `server/src/repositories/emailVerification.js` — `upsert`, `findByEmail` |
| Mailer | `server/src/services/mailer.js` — `sendVerificationEmail` |
| Frontend API | `client/src/api/auth.js` — `sendEmailCode(formData)` |
| Frontend UI | `client/src/pages/auth/Signup.jsx` — Step 1 (폼 입력) |

---

### 이메일 인증 코드 검증 + 계정 생성

**`POST /auth/email/verify`**

설명: 사용자가 입력한 6자리 코드를 검증한다. 성공 시 임시 저장된 payload로 계정을 생성하고, access/refresh token을 쿠키로 발급해 자동 로그인한다. 코드 만료·5회 초과 시 레코드를 삭제하여 재발송을 유도한다.

**인증**: 불필요

---

**Request Body** (`application/json`)

```json
{
  "email": "string",   // 필수, 이메일 형식
  "code":  "string"    // 필수, 6자리 숫자
}
```

---

**Response 201 Created**

```json
{
  "data": {
    "success": true,
    "message": "회원가입이 완료되었습니다.",
    "user": {
      "id":            "uuid",
      "handle":        "string",
      "name":          "string",
      "email":         "string",
      "bio":           "string",
      "profile_image": "string | null",
      "birth_date":    "YYYY-MM-DD",
      "created_at":    "ISO8601"
    }
  }
}
```

쿠키 설정:
```
accessToken   HttpOnly, maxAge 1h
refreshToken  HttpOnly, maxAge 14d
```

---

**Response Errors**

| Status | Code | 메시지 | 발생 조건 |
| --- | --- | --- | --- |
| 400 | `INVALID_INPUT` | "입력 형식이 올바르지 않습니다." | email/code 형식 오류 |
| 401 | `INVALID_CODE` | "인증 코드가 올바르지 않습니다." | 코드 불일치 |
| 401 | `CODE_EXPIRED` | "인증 코드가 만료되었습니다. 다시 요청해주세요." | expires_at 초과 |
| 401 | `TOO_MANY_ATTEMPTS` | "시도 횟수를 초과했습니다. 다시 요청해주세요." | 5회 초과 후 재시도 |
| 404 | `CODE_NOT_FOUND` | "인증 요청을 찾을 수 없습니다. 코드를 다시 요청해주세요." | record 없음 |
| 409 | `HANDLE_TAKEN` | "이미 사용 중인 아이디입니다." | verify 시점 handle 중복 (race condition 방어) |
| 409 | `EMAIL_TAKEN` | "이미 가입된 이메일입니다." | verify 시점 email 중복 (race condition 방어) |

---

**DB 동작**

```
email_verifications SELECT WHERE email = :email
  → 만료 or 5회 초과 시: DELETE → 에러
  → 코드 불일치: attempts++ (UPDATE)
  → 코드 일치:
      users INSERT (profile_image를 파일로 디스크 저장 후 URL)
      users UPDATE refresh_token
      email_verifications DELETE
```

---

**구현 위치**

| 레이어 | 파일 |
| --- | --- |
| Route | `server/src/routes/auth.js` |
| Controller | `server/src/controllers/auth.js` — `exports.verifyEmailCode` |
| Service | `server/src/services/auth.js` — `exports.verifyEmailAndCreateAccount` |
| Repository | `server/src/repositories/emailVerification.js` — `findByEmail`, `incrementAttempts`, `deleteByEmail` |
| Frontend API | `client/src/api/auth.js` — `verifyEmailCode({ email, code })` |
| Frontend UI | `client/src/pages/auth/Signup.jsx` — Step 2 (코드 입력, 재발송 쿨다운) |

---

## Messenger

### 채팅방 이름 변경

**`PATCH /chat-rooms/:id`**

설명: 그룹 채팅방의 이름을 변경한다. 채팅방 멤버라면 누구든 변경 가능하다. 1:1 채팅방은 변경 불가.

**인증**: 필요

---

**Path Params**

```
:id   // chat_rooms.id (UUID)
```

---

**Request Body**

```json
{
  "name": "string"   // 필수, 1~100자
}
```

---

**Response 200 OK**

```json
{
  "data": {
    "success": true,
    "room": {
      "id":   "uuid",
      "name": "string"
    }
  }
}
```

---

**Response Errors**

| Status | Code | 메시지 | 발생 조건 |
| --- | --- | --- | --- |
| 400 | `INVALID_ROOM_ID` | "채팅방 ID 형식이 올바르지 않습니다." | :id가 UUID 형식 아님 |
| 400 | `INVALID_NAME` | "채팅방 이름을 입력해주세요." | name 누락 또는 빈 문자열 |
| 400 | `NAME_TOO_LONG` | "채팅방 이름은 100자 이하로 입력해주세요." | name 100자 초과 |
| 400 | `DIRECT_ROOM` | "1:1 채팅방은 이름을 변경할 수 없습니다." | type === 'direct' |
| 401 | — | "인증이 필요합니다." | 로그인 상태 아님 |
| 403 | `NOT_MEMBER` | "채팅방 멤버가 아닙니다." | 본인이 room_members 아님 |
| 404 | `ROOM_NOT_FOUND` | "채팅방을 찾을 수 없습니다." | room 없음 |

---

**DB 동작**

```
chat_rooms UPDATE — name = :name, updated_at = NOW()
```

---

**구현 위치**

| 레이어 | 파일 |
| --- | --- |
| Route | `server/src/routes/messenger.js` |
| Controller | `server/src/controllers/messenger.js` — `exports.renameRoom` |
| Service | `server/src/services/messenger.js` — `exports.renameRoom` |
| Repository | `server/src/repositories/messenger.js` — `exports.updateRoomName` |
| Frontend API | `client/src/api/messenger.js` — `renameRoom(roomId, name)` |

---

## User

### 공개 프로필 조회

**`GET /users/:id`**

설명: 특정 사용자의 공개 프로필 정보를 조회한다. 이메일·생년월일은 개인정보 보호를 위해 응답에서 제외한다.

**인증**: 필요

---

**Path Params**

```
:id   // users.id (UUID)
```

---

**Response 200 OK**

```json
{
  "data": {
    "success": true,
    "user": {
      "id":            "uuid",
      "handle":        "string",
      "name":          "string",
      "bio":           "string",
      "profile_image": "string | null"
    }
  }
}
```

---

**Response Errors**

| Status | Code | 메시지 | 발생 조건 |
| --- | --- | --- | --- |
| 400 | `INVALID_USER_ID` | "사용자 ID 형식이 올바르지 않습니다." | :id가 UUID 형식 아님 |
| 401 | — | "인증이 필요합니다." | 로그인 상태 아님 |
| 404 | `USER_NOT_FOUND` | "존재하지 않는 사용자입니다." | user 없음 |

---

**DB 동작**

```
users SELECT — id, handle, name, bio, profile_image WHERE id = :id
```

---

**구현 위치**

| 레이어 | 파일 |
| --- | --- |
| Route | `server/src/routes/users.js` |
| Controller | `server/src/controllers/users.js` — `exports.getUserProfile` |
| Repository | `server/src/repositories/user.js` — `exports.findById` (기존 재사용) |
| Frontend API | `client/src/api/user.js` — `getUserProfile(userId)` |
| Frontend Page | `client/src/pages/UserProfile.jsx` |

---

*최종 수정: 2026-05-19*
