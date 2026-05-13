const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/user');
const storage = require('./storage');
const {
    ConflictError,
    NotFoundError,
    UnauthorizedError
} = require('../errors/AppError');

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '14d';

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