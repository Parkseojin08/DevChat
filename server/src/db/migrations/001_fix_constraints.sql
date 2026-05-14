-- =============================================================
-- Migration 001: fix_constraints
-- 작성일: 2026-05-14
-- 대상 스키마: chatdata
-- =============================================================
-- 이 파일은 이미 DB가 운영 중인 경우 아래 ALTER 구문을 실행해
-- sql.sql 정의와 실제 DB를 일치시킵니다.
-- 새로 DB를 초기화하는 경우 sql.sql 재실행으로 충분합니다.
-- =============================================================

BEGIN;

-- [C-2] messages.is_deleted DEFAULT FALSE 추가
-- NOT NULL인데 DEFAULT가 없으면 INSERT 시 매번 명시 필요.
-- Soft delete 컬럼 표준은 DEFAULT FALSE.
ALTER TABLE chatdata.messages
  ALTER COLUMN is_deleted SET DEFAULT FALSE;

-- [C-3] chat_rooms.direct_key UNIQUE 제약 추가
-- 1:1 채팅방 중복 방지를 위해 UNIQUE 필수.
-- Messenger ON CONFLICT DO UPDATE RETURNING 패턴의 전제 조건.
-- 주의: 중복 direct_key 데이터가 이미 존재한다면 아래 구문 실행 전
--       중복 row를 먼저 수동 정리해야 합니다.
ALTER TABLE chatdata.chat_rooms
  ADD CONSTRAINT chat_rooms_direct_key_unique UNIQUE (direct_key);

-- [H-6] users.refresh_token DEFAULT NULL로 변경
-- 로그아웃 시 서비스 코드가 NULL을 저장하는데 DB 기본값은 ''(빈 문자열)이라
-- 의미론적 불일치 발생. NULL이 "토큰 없음"을 명확히 표현.
ALTER TABLE chatdata.users
  ALTER COLUMN refresh_token SET DEFAULT NULL;

-- 기존 빈 문자열 데이터를 NULL로 정리 (신규 가입 후 미로그인 사용자 대상)
UPDATE chatdata.users
  SET refresh_token = NULL
  WHERE refresh_token = '';

COMMIT;

-- =============================================================
-- DOWN (롤백이 필요한 경우 수동 실행)
-- =============================================================
-- BEGIN;
--
-- ALTER TABLE chatdata.messages
--   ALTER COLUMN is_deleted DROP DEFAULT;
--
-- ALTER TABLE chatdata.chat_rooms
--   DROP CONSTRAINT IF EXISTS chat_rooms_direct_key_unique;
--
-- ALTER TABLE chatdata.users
--   ALTER COLUMN refresh_token SET DEFAULT '';
--
-- COMMIT;
-- =============================================================
