import { loadEdits, roomSaved, saveRoom } from './world.service.js';
import { SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, HAIR_STYLES, HATS, MAX_PLAYERS } from '../../shared/games.js';
import { SPAWN, SX, SY, SZ } from '../../shared/world.js';
import { createVehicles } from './vehicle.service.js';

/**
 * Rooms live in memory while anyone is in them. A room's blocks are saved to
 * disk, so the house you built last night is still there tonight.
 */

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const EMPTY_TTL = 10 * 60 * 1000;

export const normaliseCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

function newCode() {
    for (;;) {
        let code = '';
        for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        if (!rooms.has(code) && !roomSaved(code)) return code;
    }
}

function makeRoom(code) {
    const saved = loadEdits(code);
    const room = {
        code,
        createdAt: saved?.createdAt || Date.now(),
        edits: saved?.edits || new Map(),
        players: new Map(),
        chat: [],
        game: null,
        vehicles: createVehicles(),
        emptySince: Date.now(),
    };
    rooms.set(code, room);
    return room;
}

export function createRoom() {
    const room = makeRoom(newCode());
    saveRoom(room);
    return room;
}

/** Any code works: joining one nobody has used yet simply starts a fresh world. */
export function getOrCreateRoom(code) {
    const c = normaliseCode(code);
    if (c.length < 3) return null;
    return rooms.get(c) || makeRoom(c);
}

export const findRoom = (code) => rooms.get(normaliseCode(code)) || null;
export const roomExists = (code) => rooms.has(normaliseCode(code)) || roomSaved(normaliseCode(code));
export const allRooms = () => rooms.values();
export const isFull = (room) => room.players.size >= MAX_PLAYERS;

const oneOf = (list, v, fallback) => (list.includes(v) ? v : fallback);

/** Only the looks the lobby offers, so nobody can inject markup or giant names. */
export function cleanProfile(p = {}) {
    const name = String(p.name || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
    return {
        name,
        skin: oneOf(SKIN_TONES, p.skin, SKIN_TONES[0]),
        hair: oneOf(HAIR_COLOURS, p.hair, HAIR_COLOURS[1]),
        hairStyle: oneOf(HAIR_STYLES, p.hairStyle, 'short'),
        shirt: oneOf(OUTFIT_COLOURS, p.shirt, OUTFIT_COLOURS[0]),
        pants: oneOf(OUTFIT_COLOURS, p.pants, OUTFIT_COLOURS[5]),
        hat: oneOf(HATS, p.hat, 'none'),
    };
}

export function addPlayer(room, pid, socketId, profile) {
    const player = {
        id: pid,
        socketId,
        ...cleanProfile(profile),
        pos: [...SPAWN.pos],
        yaw: SPAWN.yaw,
        joinedAt: Date.now(),
    };
    room.players.set(pid, player);
    room.emptySince = null;
    return player;
}

export function removePlayer(room, pid) {
    room.players.delete(pid);
    if (room.players.size === 0) room.emptySince = Date.now();
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export function movePlayer(player, data) {
    const p = data?.p;
    if (!Array.isArray(p) || p.length !== 3 || !p.every(finite)) return false;
    player.pos = [Math.max(-8, Math.min(SX + 8, p[0])), Math.max(-64, Math.min(SY + 64, p[1])), Math.max(-8, Math.min(SZ + 8, p[2]))];
    if (finite(data.r)) player.yaw = data.r;
    return true;
}

export const publicPlayer = (p) => ({
    id: p.id,
    name: p.name,
    skin: p.skin,
    hair: p.hair,
    hairStyle: p.hairStyle,
    shirt: p.shirt,
    pants: p.pants,
    hat: p.hat,
    pos: p.pos,
    yaw: p.yaw,
});

export function addChat(room, msg) {
    room.chat.push(msg);
    if (room.chat.length > 50) room.chat.shift();
}

/* Forget rooms nobody has been in for a while; their blocks are on disk. */
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
        if (room.players.size === 0 && room.emptySince && now - room.emptySince > EMPTY_TTL) {
            saveRoom(room);
            rooms.delete(code);
        }
    }
}, 60 * 1000).unref();
