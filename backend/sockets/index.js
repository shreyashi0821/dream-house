import {
    getOrCreateRoom,
    isFull,
    addPlayer,
    removePlayer,
    movePlayer,
    publicPlayer,
    addChat,
    cleanProfile,
} from '../services/room.service.js';
import { setBlock, packEdits, blockAt } from '../services/world.service.js';
import { startGame, gameAction, endGame, playerLeft, canEdit, currentView, GameError } from '../services/game.service.js';
import { idx, inBounds } from '../../shared/world.js';
import { enterVehicle, exitVehicle, moveVehicle, ejectAll, resetVehicle, publicVehicle } from '../services/vehicle.service.js';

/* Games whose rules happen in a panel, so driving around during them is fine. */
const CALM_GAMES = new Set(['drawGuess', 'coupleQuiz']);

/**
 * Everything realtime. A socket joins one room; from then on every event is
 * scoped to it. Movement is relayed as volatile messages (a dropped position
 * is replaced 1/15 s later anyway); blocks, chat and games are reliable.
 */

const PID = /^[a-zA-Z0-9_-]{8,40}$/;
const EMOTES = new Set(['hearts', 'wave', 'kiss', 'laugh', 'dance']);

/** A token bucket per socket, so one runaway tab cannot flood a room. */
function limiter(perSecond, burst) {
    let tokens = burst;
    let last = Date.now();
    return () => {
        const now = Date.now();
        tokens = Math.min(burst, tokens + ((now - last) / 1000) * perSecond);
        last = now;
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
    };
}

export function registerSockets(io) {
    io.on('connection', (socket) => {
        let room = null;
        let pid = null;
        const limits = { block: limiter(25, 40), chat: limiter(1, 5), emote: limiter(2, 4), game: limiter(40, 60) };

        const me = () => room?.players.get(pid);

        socket.on('room:join', (payload = {}, ack = () => {}) => {
            if (room) return ack({ ok: false, message: 'Already in a room.' });
            if (!PID.test(String(payload.pid || ''))) return ack({ ok: false, message: 'Missing player id.' });
            const r = getOrCreateRoom(payload.code);
            if (!r) return ack({ ok: false, message: 'Room codes are at least 3 letters.' });

            // The same person in a second tab replaces the first.
            const existing = r.players.get(payload.pid);
            if (existing) {
                io.sockets.sockets.get(existing.socketId)?.disconnect(true);
                removePlayer(r, payload.pid);
            }
            if (isFull(r)) return ack({ ok: false, message: 'This world is full.' });

            room = r;
            pid = payload.pid;
            const player = addPlayer(room, pid, socket.id, payload.profile);
            socket.join(room.code);
            socket.to(room.code).emit('player:joined', publicPlayer(player));
            ack({
                ok: true,
                you: pid,
                code: room.code,
                players: [...room.players.values()].map(publicPlayer),
                edits: packEdits(room),
                chat: room.chat,
                game: currentView(room, pid),
                vehicles: room.vehicles.map(publicVehicle),
            });
            const msg = { id: `${Date.now()}-${pid}`, system: true, text: `${player.name} joined the world 💫`, at: Date.now() };
            addChat(room, msg);
            io.to(room.code).emit('chat:message', msg);
        });

        socket.on('player:move', (data) => {
            const p = me();
            if (!p || !movePlayer(p, data)) return;
            socket.volatile.to(room.code).emit('player:moved', {
                id: pid,
                p: p.pos,
                r: p.yaw,
                m: !!data.m,
                f: !!data.f,
                h: Number.isInteger(data.h) ? data.h : 0,
            });
        });

        socket.on('profile:update', (profile) => {
            const p = me();
            if (!p) return;
            Object.assign(p, cleanProfile({ ...p, ...profile }));
            io.to(room.code).emit('player:updated', publicPlayer(p));
        });

        socket.on('world:set', (data = {}) => {
            if (!me() || !limits.block()) return;
            const { x, y, z, id } = data;
            if (!canEdit(room, pid, x, y, z, id)) {
                // Tell the sender what is really there so their world snaps back.
                if (inBounds(x, y, z)) socket.emit('world:set', { i: idx(x, y, z), id: blockAt(room, x, y, z) });
                return;
            }
            if (setBlock(room, x, y, z, id)) io.to(room.code).emit('world:set', { i: idx(x, y, z), id, by: pid });
        });

        socket.on('chat:send', (data = {}) => {
            const p = me();
            if (!p || !limits.chat()) return;
            const text = String(data.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
            if (!text) return;
            const msg = { id: `${Date.now()}-${pid}`, from: pid, name: p.name, color: p.shirt, text, at: Date.now() };
            addChat(room, msg);
            io.to(room.code).emit('chat:message', msg);
        });

        socket.on('emote', (data = {}) => {
            if (!me() || !limits.emote() || !EMOTES.has(data.kind)) return;
            io.to(room.code).emit('emote', { id: pid, kind: data.kind });
        });

        socket.on('vehicle:enter', (data = {}, ack = () => {}) => {
            if (!me()) return ack({ ok: false, message: 'Join a world first.' });
            const g = room.game;
            if (g && g.state.phase !== 'over' && !CALM_GAMES.has(g.id)) return ack({ ok: false, message: 'No driving during this game 😉' });
            const res = enterVehicle(room, pid, String(data.id));
            if (!res.ok) return ack(res);
            io.to(room.code).emit('vehicle:update', publicVehicle(res.vehicle));
            ack({ ok: true, seat: res.seat });
        });

        socket.on('vehicle:exit', () => {
            if (!me()) return;
            const v = exitVehicle(room, pid);
            if (v) io.to(room.code).emit('vehicle:update', publicVehicle(v));
        });

        socket.on('vehicle:move', (data) => {
            if (!me()) return;
            const v = moveVehicle(room, pid, data);
            if (v) socket.volatile.to(room.code).emit('vehicle:moved', { id: v.id, p: v.pos, r: v.yaw, s: v.speed, st: v.steer, t: v.tilt });
        });

        socket.on('vehicle:reset', (data = {}) => {
            if (!me()) return;
            const v = resetVehicle(room, pid, String(data.id));
            if (v) io.to(room.code).emit('vehicle:update', { ...publicVehicle(v), reset: true });
        });

        socket.on('game:start', (data = {}, ack = () => {}) => {
            if (!me()) return ack({ ok: false, message: 'Join a world first.' });
            for (const v of ejectAll(room)) io.to(room.code).emit('vehicle:update', publicVehicle(v));
            try {
                startGame(room, String(data.id), pid);
                ack({ ok: true });
            } catch (err) {
                if (!(err instanceof GameError)) console.error('[game:start]', err);
                ack({ ok: false, message: err instanceof GameError ? err.message : 'Could not start that game.' });
            }
        });

        socket.on('game:action', (action) => {
            if (!me() || !limits.game()) return;
            try {
                gameAction(room, pid, action);
            } catch (err) {
                console.error('[game:action]', err);
            }
        });

        socket.on('game:close', () => {
            if (me()) endGame(room);
        });

        socket.on('disconnect', () => {
            if (!room || room.players.get(pid)?.socketId !== socket.id) return;
            const p = me();
            const car = exitVehicle(room, pid);
            if (car) io.to(room.code).emit('vehicle:update', publicVehicle(car));
            removePlayer(room, pid);
            playerLeft(room, pid);
            socket.to(room.code).emit('player:left', { id: pid });
            const msg = { id: `${Date.now()}-${pid}-left`, system: true, text: `${p?.name || 'Someone'} left`, at: Date.now() };
            addChat(room, msg);
            io.to(room.code).emit('chat:message', msg);
        });
    });
}
