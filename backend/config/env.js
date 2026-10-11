import dotenv from 'dotenv';

/**
 * Loaded as the very first import of the app, so .env is in place before any
 * other module body reads process.env (ES modules evaluate imports first).
 */
dotenv.config();

export function checkEnv() {
    if (!process.env.ALLOWED_ORIGINS && isProduction()) {
        console.warn('[env] ALLOWED_ORIGINS is not set — any site may open a socket to this server.');
    }
}

export const isProduction = () => process.env.NODE_ENV === 'production';

/** Origins allowed to talk to the API, or '*' when none are configured. */
export const allowedOrigins = () => {
    const list = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);
    return list.length ? list : '*';
};
