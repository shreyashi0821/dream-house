/**
 * One place where failures become responses.
 *
 * Controllers throw; this decides what the person sees. Internal details never
 * cross the wire in production.
 */

/** Wrap an async controller so a rejected promise reaches the handler below. */
export const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/** A failure we chose to surface, with wording meant for a person. */
export class AppError extends Error {
    constructor(message, { status = 400, code = 'bad_request' } = {}) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
    }
}

export const notFound = (req, res) =>
    res.status(404).json({ success: false, code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, req, res, next) {
    const inProduction = process.env.NODE_ENV === 'production';
    const status = error.status || error.statusCode || 500;
    let message = error.message || 'Something went wrong.';

    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, error);
        if (inProduction) message = 'Something went wrong on our end. Try again in a moment.';
    }

    res.status(status).json({
        success: false,
        code: error.code || 'server_error',
        message,
        ...(inProduction ? {} : { stack: error.stack?.split('\n').slice(0, 4) }),
    });
}
