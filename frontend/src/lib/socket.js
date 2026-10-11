import { io } from 'socket.io-client';
import { baseURL } from '@/axios/axiosInstance';

/** One socket for the whole app, opened when a world is entered. */
let socket = null;

export function openSocket() {
    if (socket) return socket;
    socket = io(baseURL || undefined, { transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 });
    return socket;
}

export function closeSocket() {
    socket?.close();
    socket = null;
}

export const getSocket = () => socket;

/** emit with an acknowledgement, as a promise */
export const request = (event, data) =>
    new Promise((resolve) => {
        if (!socket) return resolve({ ok: false, message: 'Not connected.' });
        socket.timeout(8000).emit(event, data, (err, res) => resolve(err ? { ok: false, message: 'The server did not answer.' } : res));
    });

/** A stable id for this browser tab, so a reload rejoins as the same player. */
export function playerId() {
    try {
        let id = sessionStorage.getItem('dc-pid');
        if (!id) {
            id = `p_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
            sessionStorage.setItem('dc-pid', id);
        }
        return id;
    } catch {
        return `p_${Math.random().toString(36).slice(2, 14)}`;
    }
}
