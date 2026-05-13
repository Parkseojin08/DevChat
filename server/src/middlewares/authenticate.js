const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors/AppError');

exports.authenticate = (req, res, next) => {
    const token = req.cookies?.accessToken;

    if (!token) {
        return next(new UnauthorizedError('UNAUTHENTICATED', '인증이 필요합니다.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('TOKEN_EXPIRED', '토큰이 만료되었습니다.'));
        }
        return next(new UnauthorizedError('INVALID_TOKEN', '유효하지 않은 토큰입니다.'));
    }
};
