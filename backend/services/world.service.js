import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateWorld, idx, inBounds, fromIdx, SX, SY, SZ, G } from '../../shared/world.js';
import { AIR, BLOCKS, BLOCK_COUNT } from '../../shared/blocks.js';

/**
 * The block world, shared by every room.
 *
 * Every room starts from the same generated world, so we build it once and a
 * room only remembers the blocks its players changed. Those edits are what
 * gets saved to disk and sent to someone joining, which keeps a whole house
 * of building down to a few kilobytes.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'rooms');
fs.mkdirSync(DATA_DIR, { recursive: true });

const BASE = generateWorld();
const MAX_EDITS = 200_000;

export const blockAt = (room, x, y, z) => {
    if (!inBounds(x, y, z)) return AIR;
    const i = idx(x, y, z);
    return room.edits.has(i) ? room.edits.get(i) : BASE[i];
};
export const isSolidAt = (room, x, y, z) => BLOCKS[blockAt(room, x, y, z)].solid;
export const isAirAt = (room, x, y, z) => blockAt(room, x, y, z) === AIR;

/** Apply one edit. Returns false when it is not a real change or not allowed. */
export function setBlock(room, x, y, z, id) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return false;
    if (!inBounds(x, y, z) || y === 0) return false;
    if (!Number.isInteger(id) || id < 0 || id >= BLOCK_COUNT) return false;
    if (id !== AIR && !BLOCKS[id].placeable) return false;
    const i = idx(x, y, z);
    if (blockAt(room, x, y, z) === id) return false;
    if (BASE[i] === id) room.edits.delete(i);
    else {
        if (room.edits.size >= MAX_EDITS) return false;
        room.edits.set(i, id);
    }
    scheduleSave(room);
    return true;
}

/** Edits as a flat [index, id, index, id, …] list, the cheapest thing to send. */
export const packEdits = (room) => {
    const out = new Array(room.edits.size * 2);
    let k = 0;
    for (const [i, id] of room.edits) {
        out[k++] = i;
        out[k++] = id;
    }
    return out;
};

/** Random free spots to stand on inside the house and garden, for coins. */
export function findSpots(room, count, area = { x0: 100, z0: 92, x1: 153, z1: 148 }) {
    const levels = [G + 1, G + 7, G + 13];
    const spots = [];
    const taken = new Set();
    for (let tries = 0; spots.length < count && tries < count * 80; tries++) {
        const x = area.x0 + Math.floor(Math.random() * (area.x1 - area.x0 + 1));
        const z = area.z0 + Math.floor(Math.random() * (area.z1 - area.z0 + 1));
        const y = levels[Math.floor(Math.random() * levels.length)];
        const key = `${x},${z}`;
        if (taken.has(key)) continue;
        if (isAirAt(room, x, y, z) && isAirAt(room, x, y + 1, z) && isSolidAt(room, x, y - 1, z)) {
            taken.add(key);
            spots.push([x, y, z]);
        }
    }
    return spots;
}

/* ── Saving ───────────────────────────────────────────────────────────── */

const fileFor = (code) => path.join(DATA_DIR, `${code}.json`);
const timers = new Map();

function scheduleSave(room) {
    if (timers.has(room.code)) return;
    timers.set(
        room.code,
        setTimeout(() => {
            timers.delete(room.code);
            saveRoom(room);
        }, 2000)
    );
}

export function saveRoom(room) {
    const body = JSON.stringify({ code: room.code, createdAt: room.createdAt, edits: packEdits(room) });
    fs.writeFile(fileFor(room.code), body, (err) => err && console.error(`[world] could not save ${room.code}:`, err.message));
}

export function loadEdits(code) {
    try {
        const raw = JSON.parse(fs.readFileSync(fileFor(code), 'utf8'));
        const edits = new Map();
        for (let k = 0; k + 1 < raw.edits.length; k += 2) edits.set(raw.edits[k], raw.edits[k + 1]);
        return { edits, createdAt: raw.createdAt };
    } catch {
        return null;
    }
}

export const roomSaved = (code) => fs.existsSync(fileFor(code));

export { fromIdx, idx, SX, SY, SZ };
