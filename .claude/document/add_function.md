# 추가 기능 명세 (API 명세서 미등재)

원본 API 명세서에 포함되지 않은 추가 구현 기능 목록.

---

# 목록

1. [**Messenger**](#messenger)
2. [**User**](#user)

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

*최종 수정: 2026-05-18*
