const authService = require('../services/auth');
const { ValidationError } = require('../errors/AppError');

// profile_image 관련 URL 검증 상수는 파일 업로드 방식으로 전환했으므로 제거됨

const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 50;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BIO_MAX = 200;
const EMAIL_CODE_RE = /^\d{6}$/;

const isProd = () => process.env.NODE_ENV === 'production';

const accessCookieOptions = () => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000 // 1h
});

const refreshCookieOptions = () => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14d
});

// clearCookie도 set 시와 동일한 옵션을 줘야 일부 브라우저에서 안전하게 삭제됨
const clearCookieOptions = () => ({
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax'
});

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isValidName = (v) => isNonEmptyString(v) && v.length <= NAME_MAX;

exports.signUp = async (req, res, next) => {
    try {
        // multipart/form-data: 텍스트 필드는 req.body, 파일은 req.file
        const { handle, email, name, password, birth_date } = req.body || {};
        const profileFile = req.file; // multer가 파싱한 파일 객체 (없으면 undefined)

        const errors = [];

        if (!isNonEmptyString(handle) || !HANDLE_RE.test(handle)) {
            errors.push({ field: 'handle', message: '3~20자의 영문/숫자/_만 사용 가능합니다.' });
        }
        if (!isNonEmptyString(email) || !EMAIL_RE.test(email)) {
            errors.push({ field: 'email', message: '이메일 형식이 올바르지 않습니다.' });
        }
        if (!isValidName(name)) {
            errors.push({ field: 'name', message: '이름은 1~50자여야 합니다.' });
        }
        if (!isNonEmptyString(password) || !PASSWORD_RE.test(password)) {
            errors.push({ field: 'password', message: '비밀번호는 8자 이상이며 영문·숫자·특수문자를 포함해야 합니다.' });
        }
        if (!isNonEmptyString(birth_date) || !BIRTH_DATE_RE.test(birth_date)) {
            errors.push({ field: 'birth_date', message: 'YYYY-MM-DD 형식이어야 합니다.' });
        }

        if (errors.length > 0) {
            throw new ValidationError('INVALID_INPUT', '입력 형식이 올바르지 않습니다.', errors);
        }

        await authService.signUp({ handle, email, name, password, birth_date, profileFile });

        return res.status(201).json({
            data: {
                success: true,
                message: '회원가입을 성공하였습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/email/send-code
 *
 * 회원가입 정보를 받아 형식 검증 후 service로 위임.
 * service가 이메일 발송까지 처리 (성공/실패 본문은 service에서 throw).
 *
 * multipart/form-data — profile_image 파일 동반 가능 (signUp과 동일).
 */
exports.sendEmailCode = async (req, res, next) => {
    try {
        const { handle, email, name, password, birth_date } = req.body || {};
        const profileFile = req.file;

        const errors = [];

        if (!isNonEmptyString(handle) || !HANDLE_RE.test(handle)) {
            errors.push({ field: 'handle', message: '3~20자의 영문/숫자/_만 사용 가능합니다.' });
        }
        if (!isNonEmptyString(email) || !EMAIL_RE.test(email)) {
            errors.push({ field: 'email', message: '이메일 형식이 올바르지 않습니다.' });
        }
        if (!isValidName(name)) {
            errors.push({ field: 'name', message: '이름은 1~50자여야 합니다.' });
        }
        if (!isNonEmptyString(password) || !PASSWORD_RE.test(password)) {
            errors.push({ field: 'password', message: '비밀번호는 8자 이상이며 영문·숫자·특수문자를 포함해야 합니다.' });
        }
        if (!isNonEmptyString(birth_date) || !BIRTH_DATE_RE.test(birth_date)) {
            errors.push({ field: 'birth_date', message: 'YYYY-MM-DD 형식이어야 합니다.' });
        }

        if (errors.length > 0) {
            throw new ValidationError('INVALID_INPUT', '입력 형식이 올바르지 않습니다.', errors);
        }

        await authService.sendEmailVerification({
            handle,
            email,
            name,
            password,
            birth_date,
            profileFile
        });

        return res.status(200).json({
            data: {
                success: true,
                message: '인증 코드가 발송되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /auth/email/verify
 *
 * email + code 검증 후 계정 생성 + 토큰 쿠키 설정.
 */
exports.verifyEmailCode = async (req, res, next) => {
    try {
        const { email, code } = req.body || {};

        const errors = [];
        if (!isNonEmptyString(email) || !EMAIL_RE.test(email)) {
            errors.push({ field: 'email', message: '이메일 형식이 올바르지 않습니다.' });
        }
        if (!isNonEmptyString(code) || !EMAIL_CODE_RE.test(code)) {
            errors.push({ field: 'code', message: '6자리 숫자 코드를 입력해주세요.' });
        }

        if (errors.length > 0) {
            throw new ValidationError('INVALID_INPUT', '입력 형식이 올바르지 않습니다.', errors);
        }

        const { user, accessToken, refreshToken } =
            await authService.verifyEmailAndCreateAccount({ email, code });

        res.cookie('accessToken', accessToken, accessCookieOptions());
        res.cookie('refreshToken', refreshToken, refreshCookieOptions());

        return res.status(201).json({
            data: {
                success: true,
                message: '회원가입이 완료되었습니다.',
                user
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.signIn = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
            throw new ValidationError('MISSING_CREDENTIALS', '이메일과 비밀번호를 입력해주세요.');
        }

        const { user, accessToken, refreshToken } = await authService.signIn({ email, password });

        res.cookie('accessToken', accessToken, accessCookieOptions());
        res.cookie('refreshToken', refreshToken, refreshCookieOptions());

        return res.status(200).json({
            data: {
                success: true,
                message: '로그인 성공',
                user
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.logOut = async (req, res, next) => {
    try {
        await authService.logout({ userId: req.user.id });

        res.clearCookie('accessToken', clearCookieOptions());
        res.clearCookie('refreshToken', clearCookieOptions());

        return res.status(200).json({
            data: {
                success: true,
                message: '로그아웃 되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.refresh = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        const result = await authService.refresh({ refreshToken });

        res.cookie('accessToken', result.accessToken, accessCookieOptions());
        res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

        return res.status(200).json({
            data: {
                success: true,
                message: '토큰이 재발급되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getProfile = async (req, res, next) => {
    try {
        const user = await authService.getProfile({ userId: req.user.id });
        return res.status(200).json({
            data: { success: true, user }
        });
    } catch (err) {
        next(err);
    }
};

exports.profileUpdate = async (req, res, next) => {
    try {
        // multipart/form-data: 텍스트 필드는 req.body, 파일은 req.file
        const { name, bio, password } = req.body || {};
        const profileFile = req.file; // 새 프로필 이미지 파일 (없으면 undefined)

        if (name !== undefined && !isValidName(name)) {
            throw new ValidationError('INVALID_NAME', 'name에 형식을 맞추어주세요.');
        }
        if (bio !== undefined && (typeof bio !== 'string' || bio.length > BIO_MAX)) {
            throw new ValidationError('INVALID_BIO', 'bio에 형식을 맞추어주세요.');
        }
        if (password !== undefined && !PASSWORD_RE.test(password)) {
            throw new ValidationError('INVALID_PASSWORD', 'password에 형식을 맞추어주세요.');
        }

        const user = await authService.updateProfile({
            userId: req.user.id,
            name,
            bio,
            profileFile,
            password
        });

        return res.status(200).json({
            data: {
                success: true,
                message: '프로필이 수정되었습니다.',
                user
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.profileDelete = async (req, res, next) => {
    try {
        const { password } = req.body || {};

        if (!isNonEmptyString(password)) {
            throw new ValidationError('MISSING_PASSWORD', '비밀번호를 입력해주세요.');
        }

        await authService.deleteAccount({ userId: req.user.id, password });

        res.clearCookie('accessToken', clearCookieOptions());
        res.clearCookie('refreshToken', clearCookieOptions());

        return res.status(200).json({
            data: {                                          
                success: true,
                message: '계정이 삭제되었습니다.'
            }
        });
    } catch (err) {
        next(err);
    }
};
