set search_path to chatdata;

BEGIN;

DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts_media;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS friend_status;
DROP TYPE IF EXISTS room_type_status;
DROP TYPE IF EXISTS notification_type;

DROP INDEX IF EXISTS idx_notifications_user_recent;
DROP INDEX IF exists idx_notifications_user_unread;
DROP INDEX IF EXISTS uq_friendship_pair;

create type friend_status as enum ('pending', 'accepted');
create type room_type_status  as enum ('direct', 'group');

CREATE TYPE notification_type AS ENUM (
  'friend_request',    /* 친구 신청 받음 */
  'friend_accepted',   /* 내 친구 신청이 수락됨 */
  'post_comment',      /* 내 게시글에 댓글 달림 */
  'post_like',         /* 내 게시글에 좋아요 달림 */
  'comment_reply',     /* 내 댓글에 대댓글 달림 */
  'chat_invite'        /* 채팅방에 초대됨 */
);


-- user table
CREATE TABLE IF NOT EXISTS users (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 사용자 고유 id */
handle          VARCHAR(20)  NOT NULL UNIQUE /* 중복 불가 사용자 고유 id = insta처럼 */,
email           VARCHAR(255) NOT NULL UNIQUE, /* 이메일 */
password_hash   VARCHAR(255) NOT NULL, /* hash된 passwrd*/
name            VARCHAR(50)  NOT NULL, /* 사용자 이름 */
birth_date      DATE         NOT NULL, /* 사용자 생일 */
bio             VARCHAR(200) NOT NULL DEFAULT '', /* 사용자 자기소개 */
profile_image   VARCHAR(500), /* 사용자 이미지 */
refresh_token   VARCHAR(512) DEFAULT NULL,
created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(), /* 사용자 생성날짜 */
updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW() /* 프로필 업데이터 날짜 */
); 
 
-- friendships table
CREATE TABLE IF NOT EXISTS friendships (
id              BIGSERIAL PRIMARY KEY, /* 친구 관계 고유 id (내부용, 순차 정수) */
requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 친구 신청을 보낸 사용자 */
addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 친구 신청을 받은 사용자 */
status         	friend_status NOT NULL, /* 신청 상태 (pending / accepted) */
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 신청 날짜 */
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 상태 변경 날짜 */
);
 
 
CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_pair
  ON chatdata.friendships (
      LEAST(requester_id::text, addressee_id::text),
      GREATEST(requester_id::text, addressee_id::text)
  );

-- posts table
CREATE TABLE IF NOT EXISTS posts (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 게시글 고유 id */
author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 게시글 작성자 */
content     TEXT NOT NULL, /* 게시글 본문 */
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 게시글 작성 날짜 */
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 게시글 수정 날짜 */
);
 
-- posts_media table

create table if not exists posts_media(
	id BIGSERIAL primary key,
	post_id UUID not null references posts(id) ON DELETE CASCADE,
	media_url   VARCHAR(500) /* 첨부 사진·미디어 URL (선택) */
);

-- comments table
CREATE TABLE IF NOT EXISTS comments (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 댓글 고유 id */
post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, /* 댓글이 달린 게시글 */
author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 댓글 작성자 */
parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
content     TEXT NOT NULL, /* 댓글 본문 */
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 댓글 작성 날짜 */
);


 
 
-- likes table
CREATE TABLE IF NOT EXISTS likes (
id          BIGSERIAL PRIMARY KEY, /* 좋아요 고유 id (내부용, 순차 정수) */
post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, /* 좋아요가 눌린 게시글 */
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, /* 좋아요를 누른 사용자 */
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 좋아요 누른 날짜 */
UNIQUE (post_id, user_id) /* 같은 사용자가 같은 게시글에 중복 좋아요 방지 */
);
 
 
-- chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), /* 채팅방 고유 id */
type        room_type_status NOT NULL, /* 채팅방 유형 (direct / group) */
name        VARCHAR(100), /* 채팅방 이름 (그룹용, 1:1은 null) */
direct_key  VARCHAR(73) UNIQUE,     -- userA + '_' + userB = 73
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 채팅방 생성 날짜 */
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 마지막 활동 날짜 */
CHECK (
    (type = 'direct' AND direct_key IS NOT NULL) OR
    (type = 'group'  AND direct_key IS NULL)
  )
);
 
 
-- messages table
CREATE TABLE IF NOT EXISTS messages (
id          BIGSERIAL PRIMARY KEY, /* 메시지 고유 id (내부용, 시간순 자동 정렬, 대용량 친화) */
room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE, /* 메시지가 속한 채팅방 */
sender_id   UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE, /* 보낸 사람 */
content     TEXT, /* 메시지 내용 */
media_url   VARCHAR(500),
is_deleted	BOOLEAN NOT NULL DEFAULT FALSE,
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() /* 보낸 시각 */
);
 

 
-- room_members table
CREATE TABLE IF NOT EXISTS room_members (
id                    BIGSERIAL PRIMARY KEY, /* 멤버십 고유 id (내부용, 순차 정수) */
room_id               UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE, /* 소속 채팅방 */
user_id               UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE, /* 멤버 사용자 */
last_read_message_id  BIGINT, /* 마지막으로 읽은 메시지 id (읽음 표시용) */
joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(), /* 채팅방 입장 날짜 */
UNIQUE (room_id, user_id) /* 같은 사용자가 같은 채팅방에 중복 가입 방지 */
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

COMMIT;

