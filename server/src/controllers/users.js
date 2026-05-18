const userRepo = require('../repositories/user');
const { ValidationError, NotFoundError } = require('../errors/AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /users/:id — 공개 프로필 조회 (이메일·생년월일 제외)
exports.getUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!UUID_RE.test(id)) {
            throw new ValidationError('INVALID_USER_ID', '사용자 ID 형식이 올바르지 않습니다.');
        }

        const user = await userRepo.findById(id);
        if (!user) {
            throw new NotFoundError('USER_NOT_FOUND', '존재하지 않는 사용자입니다.');
        }

        return res.status(200).json({
            data: {
                success: true,
                user: {
                    id:            user.id,
                    handle:        user.handle,
                    name:          user.name,
                    bio:           user.bio,
                    profile_image: user.profile_image,
                }
            }
        });
    } catch (err) {
        next(err);
    }
};
