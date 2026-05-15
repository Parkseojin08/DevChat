const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { ValidationError } = require('../errors/AppError');

// 프로필 이미지가 저장될 절대 경로
const PROFILE_DIR = path.join(__dirname, '../../uploads/profile');

// 게시글 미디어가 저장될 절대 경로
const POSTS_DIR = path.join(__dirname, '../../uploads/posts');

// 채팅 미디어가 저장될 절대 경로
const CHAT_DIR = path.join(__dirname, '../../uploads/chat');

// 허용 MIME 타입 → 확장자 맵
const ALLOWED_MIME = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

/**
 * 서버 기동 시(또는 첫 저장 시) 업로드 디렉토리가 없으면 자동 생성.
 */
const ensureProfileDir = () => {
    if (!fs.existsSync(PROFILE_DIR)) {
        fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }
};

const ensurePostsDir = () => {
    if (!fs.existsSync(POSTS_DIR)) {
        fs.mkdirSync(POSTS_DIR, { recursive: true });
    }
};

const ensureChatDir = () => {
    if (!fs.existsSync(CHAT_DIR)) {
        fs.mkdirSync(CHAT_DIR, { recursive: true });
    }
};

// 모듈 로드 시점에 디렉토리 확인
ensureProfileDir();
ensurePostsDir();
ensureChatDir();

/**
 * 프로필 이미지를 디스크에 저장하고 상대 URL을 반환한다.
 *
 * @param {Buffer} fileBuffer - multer memoryStorage에서 받은 파일 버퍼
 * @param {string} mimetype   - multer가 파싱한 MIME 타입
 * @returns {Promise<string>} 저장된 파일의 상대 URL (예: /uploads/profile/<uuid>.jpg)
 */
exports.saveProfileImage = async (fileBuffer, mimetype) => {
    const ext = ALLOWED_MIME[mimetype];
    if (!ext) {
        throw new ValidationError(
            'INVALID_FILE',
            '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다.'
        );
    }

    ensureProfileDir();

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(PROFILE_DIR, filename);

    await fsp.writeFile(filepath, fileBuffer);

    return `/uploads/profile/${filename}`;
};

/**
 * 게시글 미디어를 디스크에 저장하고 상대 URL을 반환한다.
 */
exports.savePostMedia = async (fileBuffer, mimetype) => {
    const ext = ALLOWED_MIME[mimetype];
    if (!ext) {
        throw new ValidationError(
            'INVALID_FILE',
            '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다.'
        );
    }

    ensurePostsDir();

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(POSTS_DIR, filename);

    await fsp.writeFile(filepath, fileBuffer);

    return `/uploads/posts/${filename}`;
};

/**
 * 채팅 미디어를 디스크에 저장하고 상대 URL을 반환한다.
 */
exports.saveChatMedia = async (fileBuffer, mimetype) => {
    const ext = ALLOWED_MIME[mimetype];
    if (!ext) {
        throw new ValidationError(
            'INVALID_FILE',
            '허용되지 않는 파일 형식입니다. jpg, png, webp만 업로드 가능합니다.'
        );
    }

    ensureChatDir();

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(CHAT_DIR, filename);

    await fsp.writeFile(filepath, fileBuffer);

    return `/uploads/chat/${filename}`;
};

/**
 * 상대 URL로 저장된 프로필 이미지 파일을 삭제한다.
 * 파일이 없거나 삭제 실패해도 예외를 전파하지 않는다 (orphan 방어).
 *
 * @param {string|null|undefined} relativeUrl - DB에 저장된 상대 URL
 */
exports.deleteProfileImage = async (relativeUrl) => {
    if (!relativeUrl) return;

    // /uploads/profile/<filename> 형식만 처리 — 경로 트래버설 방지
    const PREFIX = '/uploads/profile/';
    if (!relativeUrl.startsWith(PREFIX)) return;

    const filename = relativeUrl.slice(PREFIX.length);

    // 파일명에 경로 구분자가 있으면 무시 (트래버설 방지)
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return;

    const filepath = path.join(PROFILE_DIR, filename);

    try {
        await fsp.unlink(filepath);
    } catch {
        // 파일이 이미 없거나 권한 오류 → 무시
    }
};

/**
 * 게시글 미디어 파일을 디스크에서 삭제한다.
 * 파일이 없거나 삭제 실패해도 예외를 전파하지 않는다 (orphan 방어).
 *
 * @param {string|null|undefined} relativeUrl - DB에 저장된 상대 URL
 */
exports.deletePostMedia = async (relativeUrl) => {
    if (!relativeUrl) return;

    const PREFIX = '/uploads/posts/';
    if (!relativeUrl.startsWith(PREFIX)) return;

    const filename = relativeUrl.slice(PREFIX.length);

    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return;

    try {
        await fsp.unlink(path.join(POSTS_DIR, filename));
    } catch {
        // 파일이 이미 없거나 권한 오류 → 무시
    }
};