import axiosInstance from '@/axios/axiosInstance';

/**
 * The REST calls, in one place. Failures come back as an Error carrying the
 * server's own wording so the UI can show it as-is.
 */

export class ApiError extends Error {
    constructor(message, { code, status } = {}) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
    }
}

async function call(method, path, body) {
    try {
        const res = await axiosInstance.request({ method, url: path, data: body });
        return res.data?.data;
    } catch (err) {
        const data = err?.response?.data;
        throw new ApiError(data?.message || 'Could not reach the Dream Craft server. Is it running?', {
            code: data?.code,
            status: err?.response?.status,
        });
    }
}

export const api = {
    createRoom: () => call('post', '/rooms'),
    room: (code) => call('get', `/rooms/${encodeURIComponent(code)}`),
    games: () => call('get', '/rooms/games'),
};
