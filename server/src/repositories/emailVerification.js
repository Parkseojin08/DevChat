const pool = require('../db/db');

/**
 * 이메일 인증 코드 + 회원가입 임시 정보 저장/조회 리포지토리.
 *
 * email UNIQUE 제약을 이용한 UPSERT로 동일 이메일 재요청 시
 * 기존 레코드를 새 코드/payload/expires_at으로 덮어쓴다.
 */

/**
 * 이메일 인증 코드 UPSERT.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.code - 6자리 숫자 문자열
 * @param {object} params.payload - JSON 직렬화 가능한 회원가입 임시 정보
 * @param {Date}   params.expiresAt
 * @returns {Promise<{id: number, email: string, created_at: Date}>}
 */
exports.upsert = async ({ email, code, payload, expiresAt }) => {
    const { rows } = await pool.query(
        `INSERT INTO chatdata.email_verifications (email, code, payload, expires_at, attempts, created_at)
         VALUES ($1, $2, $3::jsonb, $4, 0, NOW())
         ON CONFLICT (email) DO UPDATE
            SET code       = EXCLUDED.code,
                payload    = EXCLUDED.payload,
                expires_at = EXCLUDED.expires_at,
                attempts   = 0,
                created_at = NOW()
         RETURNING id, email, created_at`,
        [email, code, JSON.stringify(payload), expiresAt]
    );
    return rows[0];
};

/**
 * 이메일에 해당하는 가장 최근(=유일) 레코드 조회.
 * @param {string} email
 * @returns {Promise<{id:number,email:string,code:string,payload:object,attempts:number,expires_at:Date,created_at:Date} | null>}
 */
exports.findByEmail = async (email) => {
    const { rows } = await pool.query(
        `SELECT id, email, code, payload, attempts, expires_at, created_at
           FROM chatdata.email_verifications
          WHERE email = $1`,
        [email]
    );
    return rows[0] || null;
};

/**
 * attempts 증가 (브루트포스 방어).
 * @param {number} id
 * @returns {Promise<number>} 증가 후 attempts
 */
exports.incrementAttempts = async (id) => {
    const { rows } = await pool.query(
        `UPDATE chatdata.email_verifications
            SET attempts = attempts + 1
          WHERE id = $1
       RETURNING attempts`,
        [id]
    );
    return rows[0]?.attempts ?? 0;
};

/**
 * 사용 완료된 레코드 삭제 (검증 성공 후 정리).
 * @param {string} email
 */
exports.deleteByEmail = async (email) => {
    await pool.query(
        `DELETE FROM chatdata.email_verifications WHERE email = $1`,
        [email]
    );
};

/**
 * 만료 레코드 일괄 삭제 (선택적 유지보수용).
 */
exports.deleteExpired = async () => {
    await pool.query(
        `DELETE FROM chatdata.email_verifications WHERE expires_at < NOW()`
    );
};
