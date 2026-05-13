class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.message = message;
        if (details !== undefined) this.details = details;
    }
}

class ConflictError extends AppError {
    constructor(code, message, details) {
        super(409, code, message, details);
        this.name = 'ConflictError';
    }
}

class NotFoundError extends AppError {
    constructor(code, message, details) {
        super(404, code, message, details);
        this.name = 'NotFoundError';
    }
}

class UnauthorizedError extends AppError {
    constructor(code, message, details) {
        super(401, code, message, details);
        this.name = 'UnauthorizedError';
    }
}

class ForbiddenError extends AppError {
    constructor(code, message, details) {
        super(403, code, message, details);
        this.name = 'ForbiddenError';
    }
}

class ValidationError extends AppError {
    constructor(code, message, details) {
        super(400, code, message, details);
        this.name = 'ValidationError';
    }
}

module.exports = {
    AppError,
    ConflictError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ValidationError
};
