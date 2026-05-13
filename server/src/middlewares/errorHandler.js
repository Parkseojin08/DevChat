const { AppError } = require('../errors/AppError');

exports.errorHandler = (err, req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error(err);
    }

    if (err instanceof AppError) {
        const body = {
            code: err.code,
            message: err.message
        };
        if (err.details !== undefined) body.errors = err.details;
        return res.status(err.statusCode).json({ error: body });
    }

    return res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: '서버 오류가 발생했습니다.'
        }
    });
};
