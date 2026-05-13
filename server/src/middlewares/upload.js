const multer = require('multer');
const { ValidationError } = require('../errors/AppError');

const ALLOWED_MIMETYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
]);

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

/**
 * multer 인스턴스 — memoryStorage 사용.
 * 실제 파일 저장은 storage.js(서비스 계층)가 담당한다.
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: FILE_SIZE_LIMIT
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new ValidationError(
                    'INVALID_FILE',
                    '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다.'
                )
            );
        }
    }
});

/**
 * multer가 던지는 LIMIT_FILE_SIZE 등의 에러를 AppError(ValidationError)로 변환하는
 * 래퍼 미들웨어 팩토리.
 *
 * 사용 예:
 *   router.post('/signup', wrapUpload(upload.single('profile_image')), controller.signUp)
 */
exports.wrapUpload = (multerMiddleware) => (req, res, next) => {
    multerMiddleware(req, res, (err) => {
        if (!err) return next();

        // multer 고유 에러 코드 처리
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(
                new ValidationError('FILE_TOO_LARGE', '파일 크기는 5MB를 초과할 수 없습니다.')
            );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(
                new ValidationError('INVALID_FILE', '예상치 못한 파일 필드입니다.')
            );
        }
        // fileFilter에서 넘긴 ValidationError 또는 기타 에러는 그대로 전달
        next(err);
    });
};

exports.upload = upload;