const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/user');
const emailVerificationRepo = require('../repositories/emailVerification');
const storage = require('./storage');
const mailer = require('./mailer');
const {
    ConflictError,
    NotFoundError,
    UnauthorizedError,
    ValidationError
} = require('../errors/AppError');

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '14d';

// 이메일 인증 코드 정책
const EMAIL_CODE_TTL_MINUTES = 10;
const EMAIL_CODE_RESEND_COOLDOWN_SEC = 60;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

/**
 * crypto.randomInt 기반 6자리 숫자 코드 생성.
 * (Math.random은 예측 가능하여 사용 금지)
 */
const generateEmailCode = () => {
    const n = crypto.randomInt(0, 1000000);
    return String(n).padStart(6, '0');
};

const issueAccessToken = (user) =>
    jwt.sign(
        { id: user.id, handle: user.handle },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );

const issueRefreshToken = (user) =>
    jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL }
    );

/**
 * @param {object} params
 * @param {Express.Multer.File|undefined} params.profileFile - multer memoryStorage 파일 객체
 */
exports.signUp = async ({ handle, email, name, password, birth_date, profileFile }) => {
    // 1. 비즈니스 검증 (먼저 모두 완료)
    if (await userRepo.existsByHandle(handle)) {
        throw new ConflictError('HANDLE_TAKEN', '현재 사용중인 ID입니다.');
    }
    if (await userRepo.existsByEmail(email)) {
        throw new ConflictError('EMAIL_TAKEN', '이미 등록된 email입니다.');
    }

    // 2. bcrypt
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 3. profile_image null로 우선 insert
    const inserted = await userRepo.insert({
        handle,
        email,
        name,
        password_hash,
        birth_date,
        profile_image: null
    });

    // 4. 파일이 있으면 저장 후 profile_image 업데이트
    //    실패하면 방금 insert한 row를 롤백(삭제)하고 에러 전파
    if (profileFile) {
        try {
            const profile_image = await storage.saveProfileImage(profileFile.buffer, profileFile.mimetype);
            await userRepo.updateProfile(inserted.id, { profile_image });
        } catch (fileErr) {
            try {
                await userRepo.deleteById(inserted.id);
            } catch (rollbackErr) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[signUp] rollback failed — orphan user row:', inserted.id, rollbackErr);
                }
            }
            throw fileErr;
        }
    }
};

exports.signIn = async ({ email, password }) => {
    const user = await userRepo.findByEmail(email);
    if (!user) {
        throw new UnauthorizedError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
        throw new UnauthorizedError('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    const accessToken = issueAccessToken({ id: user.id, handle: user.handle });
    const refreshToken = issueRefreshToken({ id: user.id });
    await userRepo.updateRefreshToken(user.id, refreshToken);

    return {
        user: {
            id: user.id,
            handle: user.handle,
            name: user.name,
            profile_image: user.profile_image
        },
        accessToken,
        refreshToken
    };
};

exports.refresh = async ({ refreshToken }) => {
    if (!refreshToken) {
        throw new UnauthorizedError('INVALID_TOKEN', '유효하지 않은 토큰입니다.');
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new UnauthorizedError('TOKEN_EXPIRED', '토큰이 만료되었습니다. 다시 로그인해주세요.');
        }
        throw new UnauthorizedError('INVALID_TOKEN', '유효하지 않은 토큰입니다.');
    }

    const stored = await userRepo.findCredentialsById(decoded.id);
    if (!stored || !stored.refresh_token || stored.refresh_token !== refreshToken) {
        throw new UnauthorizedError('TOKEN_EXPIRED', '토큰이 만료되었습니다. 다시 로그인해주세요.');
    }

    // findCredentialsById에 handle이 포함되므로 findById 이중 쿼리 불필요
    const newAccessToken = issueAccessToken({ id: stored.id, handle: stored.handle });
    const newRefreshToken = issueRefreshToken({ id: stored.id });
    await userRepo.updateRefreshToken(stored.id, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

exports.logout = async ({ userId }) => {
    await userRepo.updateRefreshToken(userId, null);
};

exports.getProfile = async ({ userId }) => {
    const user = await userRepo.findById(userId);
    if (!user) {
        throw new NotFoundError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }
    return user;
};

/**
 * @param {object} params
 * @param {Express.Multer.File|undefined} params.profileFile - 새 프로필 파일 (있을 때만)
 */
exports.updateProfile = async ({ userId, name, bio, profileFile, password }) => {
    let password_hash;
    if (password !== undefined) {
        password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    // 새 파일이 업로드됐으면:
    // 1. 신규 파일 디스크 저장
    // 2. DB 업데이트 성공 시 기존 파일 삭제
    // 3. DB 업데이트 실패 시 신규 파일 삭제 후 throw
    let profile_image;
    let oldProfileImage;
    let newFileSaved = false;

    if (profileFile) {
        // 기존 profile_image URL을 DB에서 조회
        const existing = await userRepo.findById(userId);
        oldProfileImage = existing?.profile_image ?? null;

        profile_image = await storage.saveProfileImage(profileFile.buffer, profileFile.mimetype);
        newFileSaved = true;
    }

    let updated;
    try {
        updated = await userRepo.updateProfile(userId, {
            name,
            bio,
            profile_image,  // undefined이면 COALESCE가 기존값 유지
            password_hash
        });
    } catch (dbErr) {
        // DB 실패 시 방금 저장한 신규 파일 정리 후 에러 전파
        if (newFileSaved) {
            await storage.deleteProfileImage(profile_image);
        }
        throw dbErr;
    }

    if (!updated) {
        // 업데이트 대상 row 없음 — 신규 파일 정리 후 에러
        if (newFileSaved) {
            await storage.deleteProfileImage(profile_image);
        }
        throw new NotFoundError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    // DB 성공 후 기존 파일 삭제 (storage.deleteProfileImage는 실패해도 예외 미전파)
    if (newFileSaved && oldProfileImage) {
        await storage.deleteProfileImage(oldProfileImage);
    }

    return updated;
};

/**
 * 회원가입 1단계 — 이메일 인증 코드 발송.
 *
 * 1) handle, email 중복 검증
 * 2) 60초 쿨다운 검사 (직전 발송 후 너무 빠른 재요청 차단)
 * 3) password를 즉시 bcrypt 해시 (평문 payload 저장 금지)
 * 4) profile_image 파일이 있으면 base64로 인코딩하여 payload에 보관
 *    (실제 디스크 저장은 verifyAndCreateAccount에서 수행)
 * 5) 6자리 코드 생성 → email_verifications UPSERT
 * 6) 메일 발송 — 실패 시 코드/payload 삭제 후 에러 전파
 *
 * @param {object} params
 * @param {Express.Multer.File|undefined} params.profileFile
 */
exports.sendEmailVerification = async ({ handle, email, name, password, birth_date, profileFile }) => {
    // 1. 비즈니스 중복 검증
    if (await userRepo.existsByHandle(handle)) {
        throw new ConflictError('HANDLE_TAKEN', '현재 사용중인 ID입니다.');
    }
    if (await userRepo.existsByEmail(email)) {
        throw new ConflictError('EMAIL_TAKEN', '이미 등록된 email입니다.');
    }

    // 2. 재발송 쿨다운 (created_at 기준)
    const existing = await emailVerificationRepo.findByEmail(email);
    if (existing) {
        const elapsedSec = Math.floor((Date.now() - new Date(existing.created_at).getTime()) / 1000);
        if (elapsedSec < EMAIL_CODE_RESEND_COOLDOWN_SEC) {
            const wait = EMAIL_CODE_RESEND_COOLDOWN_SEC - elapsedSec;
            throw new ValidationError(
                'RESEND_COOLDOWN',
                `잠시 후 다시 시도해주세요. (${wait}초 남음)`,
                { retryAfterSec: wait }
            );
        }
    }

    // 3. 비밀번호 즉시 해시
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 4. 파일 base64 (있을 때만)
    let profile_image_b64 = null;
    let profile_image_mime = null;
    if (profileFile) {
        profile_image_b64 = profileFile.buffer.toString('base64');
        profile_image_mime = profileFile.mimetype;
    }

    const payload = {
        handle,
        email,
        name,
        password_hash,
        birth_date,
        profile_image_b64,
        profile_image_mime
    };

    // 5. UPSERT
    const code = generateEmailCode();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60 * 1000);
    await emailVerificationRepo.upsert({ email, code, payload, expiresAt });

    // 6. 메일 발송 — 실패 시 방금 저장한 레코드 정리
    try {
        await mailer.sendVerificationCode({
            to: email,
            code,
            ttlMinutes: EMAIL_CODE_TTL_MINUTES
        });
    } catch (mailErr) {
        try {
            await emailVerificationRepo.deleteByEmail(email);
        } catch (rollbackErr) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[sendEmailVerification] rollback failed:', rollbackErr);
            }
        }
        if (process.env.NODE_ENV !== 'production') {
            console.error('[sendEmailVerification] mail send failed:', mailErr);
        }
        // 클라이언트에는 SMTP 내부 상세 노출 금지
        throw new ValidationError(
            'MAIL_SEND_FAILED',
            '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'
        );
    }
};

/**
 * 회원가입 2단계 — 인증 코드 검증 + 계정 생성 + 자동 로그인용 토큰 발급.
 *
 * 1) email 레코드 조회 (없으면 404 — 코드 발송 안 됨)
 * 2) 만료 검사
 * 3) 시도 횟수 초과 검사
 * 4) 코드 일치 검사 (불일치 시 attempts +1 후 401)
 * 5) handle/email 재중복 검사 (코드 발송 ~ 검증 사이 다른 사람이 가입했을 가능성)
 * 6) profile_image 파일 디스크 저장
 * 7) users INSERT (file 저장 실패 시 파일 정리, INSERT 실패 시 파일 정리)
 * 8) accessToken/refreshToken 발급, refresh_token DB 저장
 * 9) email_verifications 레코드 삭제
 */
exports.verifyEmailAndCreateAccount = async ({ email, code }) => {
    const record = await emailVerificationRepo.findByEmail(email);
    if (!record) {
        throw new NotFoundError('CODE_NOT_FOUND', '인증 요청 정보가 없습니다. 다시 시도해주세요.');
    }

    // 만료
    if (new Date(record.expires_at).getTime() < Date.now()) {
        // 만료 코드는 정리하여 재발송을 유도
        await emailVerificationRepo.deleteByEmail(email);
        throw new UnauthorizedError('CODE_EXPIRED', '인증 코드가 만료되었습니다. 코드를 다시 요청해주세요.');
    }

    // 시도 초과
    if (record.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
        await emailVerificationRepo.deleteByEmail(email);
        throw new UnauthorizedError(
            'TOO_MANY_ATTEMPTS',
            '인증 시도 횟수를 초과했습니다. 코드를 다시 요청해주세요.'
        );
    }

    // 코드 비교 — timing-safe
    const provided = String(code);
    const stored = String(record.code);
    const isSameLength = provided.length === stored.length;
    const isMatch =
        isSameLength &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(stored));

    if (!isMatch) {
        await emailVerificationRepo.incrementAttempts(record.id);
        throw new UnauthorizedError('INVALID_CODE', '인증 코드가 일치하지 않습니다.');
    }

    // payload 추출
    const { handle, name, password_hash, birth_date, profile_image_b64, profile_image_mime } = record.payload;

    // 코드 발송 ~ 검증 사이에 다른 사용자가 같은 handle/email로 가입했을 수 있음
    if (await userRepo.existsByHandle(handle)) {
        await emailVerificationRepo.deleteByEmail(email);
        throw new ConflictError('HANDLE_TAKEN', '현재 사용중인 ID입니다.');
    }
    if (await userRepo.existsByEmail(email)) {
        await emailVerificationRepo.deleteByEmail(email);
        throw new ConflictError('EMAIL_TAKEN', '이미 등록된 email입니다.');
    }

    // 프로필 이미지 디스크 저장 (있을 때만)
    let profile_image = null;
    if (profile_image_b64 && profile_image_mime) {
        const buffer = Buffer.from(profile_image_b64, 'base64');
        profile_image = await storage.saveProfileImage(buffer, profile_image_mime);
    }

    // users INSERT — 실패 시 방금 저장한 파일 정리
    let inserted;
    try {
        inserted = await userRepo.insert({
            handle,
            email,
            name,
            password_hash,
            birth_date,
            profile_image
        });
    } catch (dbErr) {
        if (profile_image) {
            await storage.deleteProfileImage(profile_image);
        }
        throw dbErr;
    }

    // 자동 로그인 토큰 발급
    const accessToken = issueAccessToken({ id: inserted.id, handle: inserted.handle });
    const refreshToken = issueRefreshToken({ id: inserted.id });
    await userRepo.updateRefreshToken(inserted.id, refreshToken);

    // 사용 완료 코드 삭제
    await emailVerificationRepo.deleteByEmail(email);

    return {
        user: {
            id: inserted.id,
            handle: inserted.handle,
            name: inserted.name,
            profile_image: inserted.profile_image
        },
        accessToken,
        refreshToken
    };
};

exports.deleteAccount = async ({ userId, password }) => {
    // findCredentialsById에 profile_image가 포함되므로 findById 이중 쿼리 불필요
    const stored = await userRepo.findCredentialsById(userId);
    if (!stored) {
        throw new NotFoundError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }

    const ok = await bcrypt.compare(password, stored.password_hash);
    if (!ok) {
        throw new UnauthorizedError('INVALID_PASSWORD', '비밀번호가 일치하지 않습니다.');
    }

    // DB CASCADE 삭제 전 파일 시스템에서 프로필 이미지 제거
    if (stored.profile_image) {
        await storage.deleteProfileImage(stored.profile_image);
    }

    await userRepo.deleteById(userId);
};