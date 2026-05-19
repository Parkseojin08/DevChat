-- =============================================================
-- Migration 002: email_verifications
-- 작성일: 2026-05-19
-- 대상 스키마: chatdata
-- =============================================================
-- 회원가입 시 이메일 인증 코드(6자리)를 저장하는 임시 테이블.
-- 사용자가 회원가입 폼 제출 시 코드를 발송하고, 사용자가 코드 입력 후
-- 검증되면 실제 chatdata.users INSERT가 수행됩니다.
--
-- 설계 결정:
--   * email을 UNIQUE로 두어 동일 이메일 재요청 시 UPSERT로 코드/payload 갱신
--   * payload(JSONB)에 회원가입 임시 정보를 보관 (password는 이미 해시 처리됨)
--   * expires_at으로 10분 만료 강제, 만료 코드는 검증 단계에서 거부
--   * created_at으로 60초 재발송 쿨다운 검사 (서버 측 강제)
--   * profile_image는 base64 인코딩된 buffer + mimetype을 payload에 보관
--     (verify 단계에서 디코딩하여 storage.saveProfileImage 호출)
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS chatdata.email_verifications (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE, /* 인증 대상 이메일 */
  code        CHAR(6)      NOT NULL,        /* 6자리 숫자 코드 */
  payload     JSONB        NOT NULL,        /* 회원가입 임시 정보 (handle, name, password_hash, birth_date, profile_image_b64, profile_image_mime) */
  attempts    INTEGER      NOT NULL DEFAULT 0, /* 검증 시도 횟수 (브루트포스 방어용) */
  expires_at  TIMESTAMPTZ  NOT NULL,        /* 만료 시각 (생성 + 10분) */
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW() /* 생성 시각 (쿨다운 판정용) */
);

-- 만료 코드 정리·핫쿼리용 인덱스 (email은 UNIQUE 인덱스로 이미 커버됨)
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at
  ON chatdata.email_verifications (expires_at);

COMMIT;

-- =============================================================
-- DOWN (롤백)
-- =============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS chatdata.idx_email_verifications_expires_at;
-- DROP TABLE IF EXISTS chatdata.email_verifications;
-- COMMIT;
-- =============================================================
