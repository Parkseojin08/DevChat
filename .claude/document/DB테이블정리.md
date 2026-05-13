# 테이블 목록

1. [**users**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
2. [**friendships**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
3. [**posts**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
4. [**posts_media**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
5. [**comments**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
6. [**likes**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
7. [**chat_rooms**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
8. [**messages**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
9. [**room_members**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)
10. [**notification**](https://www.notion.so/DB-359c059c36098096b830ec8cd1b669e6?pvs=21)

---

## users

**사용자 계정 정보**

```sql
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 사용자 고유 id */
  handle          VARCHAR(20)  NOT NULL UNIQUE, /* 사용자 아이디 (고유, 가입 후 변경 불가) */
  email           VARCHAR(255) NOT NULL UNIQUE, /* 이메일 (로그인용) */
  password_hash   VARCHAR(255) NOT NULL, /* 해싱된 비밀번호 */
  name            VARCHAR(50)  NOT NULL, /* 이름 */
  birth_date      DATE         NOT NULL, /* 생년월일 */
  bio             VARCHAR(200) NOT NULL DEFAULT '', /* 자기소개 */
  profile_image   VARCHAR(500), /* 프로필 사진 URL */
  refresh_token   VARCHAR(512) default '', /* 리프레시 토큰 */
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(), /* 계정 생성 날짜 */
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW() /* 마지막 수정 날짜 */
);
```

---

## friendships

**친구 신청 및 관계 상태 관리**

```sql
CREATE TYPE friend_status AS ENUM ('pending', 'accepted'); /* 친구 관계 상태 */

CREATE TABLE IF NOT EXISTS friendships (
  id              BIGSERIAL PRIMARY KEY, /* 친구 관계 고유 id */
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 신청자 */
  addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 수신자 */
  status          friend_status NOT NULL, /* 관계 상태 (pending / accepted) */
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 신청 날짜 */
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 마지막 변경 날짜 */
);
```

---

## posts

**게시글 본문**

```sql
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 게시글 고유 id */
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 작성자 */
  content     TEXT NOT NULL, /* 본문 */
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 작성 날짜 */
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 마지막 수정 날짜 */
);
```

---

## posts_media

**게시글 첨부 미디어 (사진 등)**

```sql
CREATE TABLE IF NOT EXISTS posts_media (
  id          BIGSERIAL PRIMARY KEY, /* 미디어 고유 id */
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, /* 소속 게시글 */
  media_url   VARCHAR(500) /* 미디어 파일 URL */
);
```

---

## comments

**게시글 댓글 및 대댓글 (parent_id로 계층 구분)**

```sql
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 댓글 고유 id */
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, /* 소속 게시글 */
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 작성자 */
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE, /* 부모 댓글 (대댓글일 때, 일반 댓글은 null) */
  content     TEXT NOT NULL, /* 본문 */
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 작성 날짜 */
);
```

---

## likes

**게시글 좋아요 (중복 방지)**

```sql
CREATE TABLE IF NOT EXISTS likes (
  id          BIGSERIAL PRIMARY KEY, /* 좋아요 고유 id */
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, /* 대상 게시글 */
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 좋아요 누른 사용자 */
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 누른 날짜 */
  UNIQUE (post_id, user_id) /* 같은 게시글에 중복 좋아요 방지 */
);
```

---

## chat_rooms

**채팅방 (1:1 / 그룹)**

```sql
create type room_type_status  as enum ('direct', 'group');

CREATE TABLE IF NOT EXISTS chat_rooms (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 채팅방 고유 id */
type        room_type_status NOT NULL, /* 채팅방 유형 (direct / group) */
name        VARCHAR(100), /* 채팅방 이름 (그룹용, 1:1은 null) */
direct_key  VARCHAR(73),           -- userA + '_' + userB = 73
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 채팅방 생성 날짜 */
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 마지막 활동 날짜 */
CHECK (
    (type = 'direct' AND direct_key IS NOT NULL) OR
    (type = 'group'  AND direct_key IS NULL)
  )
);
 
```

---

## messages

**채팅 메시지**

```sql
CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY, /* 메시지 고유 id */
  room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE, /* 소속 채팅방 */
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 발신자 */
  content     TEXT, /* 메시지 본문 (미디어만 보낼 시 null 가능) */
  media_url   VARCHAR(500), /* 첨부 미디어 URL */
  is_deleted  BOOLEAN NOT NULL, /* 삭제 여부 (soft delete) */
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 전송 날짜 */
);
```

---

## room_members

**채팅방 멤버 및 읽음 처리**

```sql
CREATE TABLE IF NOT EXISTS room_members (
  id                    BIGSERIAL PRIMARY KEY, /* 멤버십 고유 id */
  room_id               UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE, /* 소속 채팅방 */
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 멤버 사용자 */
  last_read_message_id  BIGINT, /* 마지막으로 읽은 메시지 id (읽음 처리용) */
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 입장 날짜 */
  UNIQUE (room_id, user_id) /* 동일 사용자가 같은 방에 중복 입장 방지 */
);
```

---

## notifications

**알림 (친구 신청, 좋아요, 댓글, 초대 등)**

```sql
CREATE TYPE notification_type AS ENUM (
  'friend_request',    /* 친구 신청 받음 */
  'friend_accepted',   /* 내 친구 신청이 수락됨 */
  'post_comment',      /* 내 게시글에 댓글 달림 */
  'post_like',         /* 내 게시글에 좋아요 달림 */
  'comment_reply',     /* 내 댓글에 대댓글 달림 */
  'chat_invite'        /* 채팅방에 초대됨 */
);

CREATE TABLE IF NOT EXISTS notifications (
  id            BIGSERIAL PRIMARY KEY, /* 알림 고유 id */
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 알림 수신자 */
  actor_id      UUID REFERENCES users(id) ON DELETE CASCADE, /* 행동을 일으킨 사람 (좋아요 누른 사람, 댓글 단 사람 등) */
  type          notification_type NOT NULL, /* 알림 종류 */
  target_id     VARCHAR(36), /* 관련 엔티티 id (post_id, comment_id, room_id, friendship_id 등 — type에 따라 해석) */
  is_read       BOOLEAN NOT NULL DEFAULT FALSE, /* 읽음 여부 */
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 발생 날짜 */
);

-- 쿼리: "내 알림 최신순 N개"
CREATE INDEX idx_notifications_user_recent
  ON notifications (user_id, created_at DESC);

-- 쿼리: "내 안읽은 알림 개수"
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id)
  WHERE is_read = FALSE;
```