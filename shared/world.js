/**
 * The Dream Craft world: terrain, the dream house and every game arena.
 *
 * Generation is deterministic, so the server and every browser build the exact
 * same world from nothing and only the blocks people change ever travel over
 * the network. The house is the original 2D plan (plan.html / main.js) turned
 * into blocks: one block for every 12 plan pixels.
 */

import {
    AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, PLANKS, GLASS, QUARTZ, SNOW, GOLD, EMERALD,
    GLOW, BEDROCK, GRAVEL, DARK_PLANKS, BOOKSHELF, OBSIDIAN, CHERRY_LEAVES, ROSE_BUSH, SUN_BUSH,
    CHOCOLATE, FROSTING, WOOL, PAINT, TILE, CARPET, CHECKER, WOOD_FLOOR, RED_WOOD_FLOOR, ROAD,
    ROAD_LINE, POOL_TILE, HEART, SEA_LANTERN, COBBLE, PUMPKIN, HAY, BLOCKS,
} from './blocks.js';

export const SX = 256;
export const SY = 64;
export const SZ = 256;
export const G = 20; // the ground: grass sits at y = G, people stand at y = G + 1
export const FLOOR_H = 6; // ground floor to first floor, in blocks

export const idx = (x, y, z) => (y * SZ + z) * SX + x;
export const inBounds = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;
export const fromIdx = (i) => [i % SX, Math.floor(i / (SX * SZ)), Math.floor(i / SX) % SZ];

/* ── The house plan, straight from the 2D drawing ─────────────────────── */

const HX = 100, HZ = 90, PX = 12;
const bx = (px) => HX + Math.round((px - 40) / PX);
const bz = (py) => HZ + Math.round((py - 50) / PX);

const ROOMS0 = [
    { name: 'Living Hall', x: 40, y: 190, w: 260, h: 240, floor: WOOD_FLOOR, paint: PAINT.cream },
    { name: 'Kitchen', x: 300, y: 190, w: 170, h: 140, floor: CHECKER, paint: PAINT.peach },
    { name: 'Toilet 1', x: 300, y: 330, w: 85, h: 100, floor: TILE.aqua, paint: PAINT.mint },
    { name: 'Bathroom 1', x: 385, y: 330, w: 85, h: 100, floor: TILE.blue, paint: PAINT.sky },
    { name: 'Lobby', x: 330, y: 430, w: 140, h: 80, floor: QUARTZ, paint: PAINT.lemon },
    { name: 'Gaming Room', x: 470, y: 310, w: 210, h: 200, floor: CARPET.galaxy, paint: PAINT.night },
    { name: 'Guest Bedroom', x: 40, y: 430, w: 210, h: 170, floor: WOOD_FLOOR, paint: PAINT.blush },
    { name: 'Staircase', x: 250, y: 430, w: 80, h: 170, floor: QUARTZ, paint: PAINT.sandstone },
];
const GAPS0 = [
    ['h', 190, 170, 205, 'door'], ['h', 190, 60, 150, 'window'], ['h', 190, 220, 290, 'window'], ['v', 40, 330, 410, 'window'],
    ['v', 300, 240, 270, 'door'], ['h', 430, 250, 300, 'open'], ['h', 430, 210, 240, 'door'],
    ['h', 190, 335, 360, 'window'], ['v', 470, 250, 280, 'door'],
    ['h', 430, 335, 360, 'door'], ['h', 430, 415, 440, 'door'],
    ['v', 330, 430, 470, 'open'], ['v', 470, 440, 470, 'door'], ['h', 510, 380, 410, 'door'],
    ['h', 310, 620, 670, 'window'], ['h', 510, 620, 670, 'window'],
    ['h', 600, 150, 180, 'door'], ['h', 600, 60, 130, 'window'], ['v', 680, 380, 420, 'door'],
];
const ROOMS1 = [
    { name: 'Master Bedroom', x: 40, y: 190, w: 200, h: 200, floor: RED_WOOD_FLOOR, paint: PAINT.lavender },
    { name: 'Closet', x: 240, y: 190, w: 90, h: 100, floor: CARPET.blossom, paint: PAINT.rose },
    { name: 'Bathroom 2', x: 240, y: 290, w: 90, h: 100, floor: TILE.teal, paint: PAINT.aqua },
    { name: 'Family Lounge', x: 330, y: 190, w: 140, h: 200, floor: WOOD_FLOOR, paint: PAINT.butter },
    { name: 'Corridor', x: 40, y: 390, w: 430, h: 60, floor: QUARTZ, paint: PAINT.linen },
    { name: 'Bedroom 3', x: 470, y: 310, w: 210, h: 200, floor: WOOD_FLOOR, paint: PAINT.ice },
    { name: 'Kids Bedroom', x: 40, y: 450, w: 210, h: 150, floor: CARPET.meadow, paint: PAINT.pistachio },
    { name: 'Toilet 2', x: 330, y: 450, w: 140, h: 60, floor: TILE.mint, paint: PAINT.seafoam },
    { name: 'Staircase', x: 250, y: 450, w: 80, h: 150, floor: QUARTZ, paint: PAINT.sandstone },
];
const GAPS1 = [
    ['h', 190, 100, 130, 'door'], ['v', 40, 345, 380, 'window'], ['v', 40, 200, 235, 'window'],
    ['v', 240, 215, 245, 'door'], ['v', 240, 325, 355, 'door'], ['h', 390, 150, 180, 'door'],
    ['h', 190, 380, 410, 'door'], ['h', 190, 420, 460, 'window'], ['v', 470, 240, 270, 'door'], ['h', 390, 345, 455, 'open'],
    ['h', 450, 150, 180, 'door'], ['h', 450, 250, 330, 'open'], ['h', 450, 380, 410, 'door'], ['v', 470, 400, 440, 'door'], ['v', 40, 400, 440, 'window'],
    ['h', 310, 600, 660, 'window'], ['h', 510, 600, 660, 'window'],
    ['h', 600, 60, 130, 'window'], ['v', 40, 560, 590, 'window'], ['h', 510, 420, 450, 'window'],
];
const OUT0 = [
    { name: 'Front Garden', x: 40, y: 50, w: 430, h: 140 },
    { name: 'Parking', x: 470, y: 50, w: 210, h: 260 },
    { name: 'Pool Deck', x: 330, y: 510, w: 350, h: 240 },
    { name: 'Back Garden', x: 40, y: 600, w: 290, h: 150 },
];
const BALCONY = { name: 'Balcony', x: 40, y: 110, w: 430, h: 80 };
const TERRACE = { name: 'Terrace Garden', x: 470, y: 50, w: 210, h: 260 };
const POOL = { x: 380, y: 560, w: 260, h: 150 };

const rectOf = (r) => ({ x0: bx(r.x), z0: bz(r.y), x1: bx(r.x + r.w), z1: bz(r.y + r.h) });

/* ── Places people and games care about ───────────────────────────────── */

export const SPAWN = { pos: [112.5, G + 1, 86.5], yaw: Math.PI };

export const SPLEEF = { x0: 177, z0: 101, x1: 194, z1: 118, y: G };
export const TICTAC = { x0: 74, z0: 98, cell: (c, r) => [76 + 4 * c + 0.5, 100 + 4 * r + 0.5] };
export const MEMORY = { x0: 72, z0: 116, card: (c, r) => [73 + 3 * c + 1, 117 + 3 * r + 1] };
/** Where the cars park. Ids are stable so every browser agrees which is which. */
export const VEHICLE_SPAWNS = [
    { id: 'jeep-orange', kind: 'jeep', color: '#ff8a3d', pos: [143.5, G + 1, 100.5], yaw: 0 },
    { id: 'jeep-teal', kind: 'jeep', color: '#2ec4b6', pos: [149.5, G + 1, 100.5], yaw: 0 },
    { id: 'monster', kind: 'monster', color: '#8a5cf6', pos: [70.5, G + 1, 85.5], yaw: -Math.PI / 2 },
    { id: 'love-buggy', kind: 'buggy', color: '#ff4d8d', pos: [168.5, G + 1, 85.5], yaw: Math.PI / 2 },
];

/** The off-road park: ramps, dirt mounds and a mud pit, east of the house. */
export const OFFROAD = { x0: 162, z0: 34, x1: 216, z1: 78 };

export const SNOW_FIELD = { a: [104.5, G + 1, 80.5], b: [124.5, G + 1, 80.5] };

/** Which tic-tac-toe cell (0-8) a block sits in, or -1. */
export function tictacCellAt(x, z) {
    const cx = x - 75, cz = z - 99;
    if (cx < 0 || cz < 0 || cx > 10 || cz > 10) return -1;
    if (cx % 4 === 3 || cz % 4 === 3) return -1;
    return Math.floor(cz / 4) * 3 + Math.floor(cx / 4);
}
/** Which memory card (0-15) a block sits in, or -1. */
export function memoryCardAt(x, z) {
    const cx = x - 73, cz = z - 117;
    if (cx < 0 || cz < 0 || cx > 10 || cz > 10) return -1;
    if (cx % 3 === 2 || cz % 3 === 2) return -1;
    return Math.floor(cz / 3) * 4 + Math.floor(cx / 3);
}

/* A seeded random so the parkour course, trees and coins land in the same
   place for everyone. */
export function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The sky parkour course: little floating platforms with gold checkpoints. */
export const PARKOUR = (() => {
    const r = rng(7);
    const y0 = G + 26;
    const pads = [];
    let x = 132, z = 66, y = y0;
    pads.push({ x, y, z, size: 5, kind: 'start' });
    x -= 5;
    for (let i = 1; i <= 24; i++) {
        const up = r() < 0.3 && y < y0 + 8;
        const down = !up && r() < 0.25 && y > y0 - 3;
        const dist = up ? 3 : 4;
        const turn = r();
        if (turn < 0.25 && z < 80) z += dist;
        else if (turn < 0.5 && z > 52) z -= dist;
        else x -= dist;
        if (up) y += 1;
        if (down) y -= 1;
        const kind = i === 24 ? 'finish' : i % 6 === 0 ? 'checkpoint' : 'pad';
        pads.push({ x, y, z, size: kind === 'pad' ? (r() < 0.35 ? 1 : 2) : 3, kind });
        x -= kind === 'pad' ? 0 : 1;
    }
    const centre = (p) => [p.x + p.size / 2, p.y + 1, p.z + p.size / 2];
    return {
        pads,
        start: centre(pads[0]),
        checkpoints: pads.filter((p) => p.kind === 'checkpoint').map(centre),
        finish: centre(pads[pads.length - 1]),
        fallY: Math.min(...pads.map((p) => p.y)) - 8,
    };
})();

/** Named zones, so the HUD can say "Kitchen" or "Roof Terrace". */
export const ZONES = [
    ...ROOMS0.map((r) => ({ name: r.name, ...rectOf(r), y0: G + 1, y1: G + FLOOR_H })),
    ...ROOMS1.map((r) => ({ name: r.name, ...rectOf(r), y0: G + 1 + FLOOR_H, y1: G + 2 * FLOOR_H })),
    { name: BALCONY.name, ...rectOf(BALCONY), y0: G + 1 + FLOOR_H, y1: G + 2 * FLOOR_H },
    { name: TERRACE.name, ...rectOf(TERRACE), y0: G + 1 + FLOOR_H, y1: G + 2 * FLOOR_H },
    { name: 'Roof Terrace', x0: bx(40), z0: bz(190), x1: bx(680), z1: bz(600), y0: G + 2 * FLOOR_H, y1: G + 2 * FLOOR_H + 6 },
    ...OUT0.map((r) => ({ name: r.name, ...rectOf(r), y0: G - 3, y1: G + FLOOR_H })),
    { name: 'Spleef Arena', x0: SPLEEF.x0 - 1, z0: SPLEEF.z0 - 1, x1: SPLEEF.x1 + 1, z1: SPLEEF.z1 + 1, y0: G - 8, y1: G + 6 },
    { name: 'Tic-Tac-Toe Board', x0: 74, z0: 98, x1: 86, z1: 110, y0: G, y1: G + 6 },
    { name: 'Memory Board', x0: 72, z0: 116, x1: 84, z1: 128, y0: G, y1: G + 6 },
    { name: 'Chocolate House', x0: 164, z0: 140, x1: 174, z1: 150, y0: G, y1: G + 8 },
    { name: 'Sky Parkour', x0: 20, z0: 40, x1: 140, z1: 95, y0: PARKOUR.fallY, y1: G + 50 },
    { name: 'Off-road Park', x0: OFFROAD.x0, z0: OFFROAD.z0, x1: OFFROAD.x1, z1: OFFROAD.z1, y0: G - 4, y1: G + 12 },
    { name: 'Lake', x0: 40, z0: 150, x1: 92, z1: 204, y0: G - 6, y1: G + 4 },
];

export function zoneAt(x, y, z) {
    for (const zn of ZONES) {
        if (x >= zn.x0 && x <= zn.x1 + 1 && z >= zn.z0 && z <= zn.z1 + 1 && y >= zn.y0 && y <= zn.y1) return zn.name;
    }
    return 'Dream Valley';
}

/* ── Noise for the hills ──────────────────────────────────────────────── */

const hash2 = (x, z) => {
    let h = Math.imul(x, 374761393) + Math.imul(z, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = smooth(x - xi), zf = smooth(z - zi);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
const fbm = (x, z) => valueNoise(x / 32, z / 32) * 0.6 + valueNoise(x / 14, z / 14) * 0.3 + valueNoise(x / 6, z / 6) * 0.1;

const FLAT = { x0: 36, z0: 36, x1: 220, z1: 220 };
const LAKE = { cx: 66, cz: 176, rx: 22, rz: 24 };

export function terrainHeight(x, z) {
    const dx = Math.max(FLAT.x0 - x, 0, x - FLAT.x1);
    const dz = Math.max(FLAT.z0 - z, 0, z - FLAT.z1);
    const d = Math.hypot(dx, dz);
    if (d === 0) return G;
    const t = smooth(Math.min(d / 26, 1));
    return Math.min(SY - 12, Math.round(G + t * (fbm(x, z) * 26 + 3)));
}
const lakeDepth = (x, z) => {
    const e = ((x - LAKE.cx) / LAKE.rx) ** 2 + ((z - LAKE.cz) / LAKE.rz) ** 2;
    if (e >= 1) return 0;
    return Math.max(1, Math.round((1 - e) * 5 + valueNoise(x / 5, z / 5)));
};

/* ── The generator ────────────────────────────────────────────────────── */

export function generateWorld() {
    const w = new Uint8Array(SX * SY * SZ);
    const set = (x, y, z, id) => {
        if (inBounds(x, y, z)) w[idx(x, y, z)] = id;
    };
    const get = (x, y, z) => (inBounds(x, y, z) ? w[idx(x, y, z)] : AIR);
    const fill = (x0, y0, z0, x1, y1, z1, id) => {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
            for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
                for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, z, id);
    };

    // Terrain and the lake
    for (let z = 0; z < SZ; z++) {
        for (let x = 0; x < SX; x++) {
            const h = terrainHeight(x, z);
            const lake = lakeDepth(x, z);
            set(x, 0, z, BEDROCK);
            for (let y = 1; y <= h; y++) set(x, y, z, y < h - 3 ? STONE : y < h ? DIRT : h > G + 16 ? SNOW : GRASS);
            if (lake) {
                for (let y = G - lake; y <= G; y++) set(x, y, z, y === G - lake ? SAND : WATER);
            } else if (lakeDepth(x - 2, z) || lakeDepth(x + 2, z) || lakeDepth(x, z - 2) || lakeDepth(x, z + 2)) {
                set(x, G, z, SAND);
            }
        }
    }

    // The road in front of the house, with a dashed centre line
    fill(36, G, 82, 220, G, 88, ROAD);
    for (let x = 36; x <= 220; x++) if (x % 4 < 2) set(x, G, 85, ROAD_LINE);

    /* ── The dream house ─────────────────────────────────────────────── */

    const footprint = (rooms) => {
        const cells = new Set();
        for (const r of rooms) {
            const { x0, z0, x1, z1 } = rectOf(r);
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells.add(x * 1000 + z);
        }
        return cells;
    };

    const buildLevel = (rooms, gaps, base, outer) => {
        const walls = new Map();
        for (const r of rooms) {
            const { x0, z0, x1, z1 } = rectOf(r);
            fill(x0, base, z0, x1, base, z1, r.floor);
            for (let x = x0; x <= x1; x++) { walls.set(x * 1000 + z0, r.paint); walls.set(x * 1000 + z1, r.paint); }
            for (let z = z0; z <= z1; z++) { walls.set(x0 * 1000 + z, r.paint); walls.set(x1 * 1000 + z, r.paint); }
        }
        for (const [key, paint] of walls) {
            const x = Math.floor(key / 1000), z = key % 1000;
            const exterior = !outer.has((x + 1) * 1000 + z) || !outer.has((x - 1) * 1000 + z) || !outer.has(x * 1000 + z + 1) || !outer.has(x * 1000 + z - 1);
            fill(x, base + 1, z, x, base + FLOOR_H - 1, z, exterior ? QUARTZ : paint);
        }
        for (const [dir, line, a, b, kind] of gaps) {
            const lo = dir === 'h' ? bx(a) : bz(a);
            const hi = Math.max(lo + 2, dir === 'h' ? bx(b) : bz(b));
            for (let t = lo; t < hi; t++) {
                const x = dir === 'h' ? t : bx(line), z = dir === 'h' ? bz(line) : t;
                if (kind === 'window') fill(x, base + 2, z, x, base + 3, z, GLASS);
                else fill(x, base + 1, z, x, base + (kind === 'open' ? FLOOR_H - 1 : 3), z, AIR);
            }
        }
        return walls;
    };

    // Outdoor ground around the house
    for (const o of OUT0) {
        const { x0, z0, x1, z1 } = rectOf(o);
        const id = o.name === 'Parking' ? ROAD : o.name === 'Pool Deck' ? PAINT.sandstone : GRASS;
        fill(x0, G, z0, x1, G, z1, id);
    }
    // The pool, three blocks deep
    {
        const { x0, z0, x1, z1 } = rectOf(POOL);
        fill(x0, G - 4, z0, x1, G, z1, POOL_TILE);
        fill(x0 + 1, G - 3, z0 + 1, x1 - 1, G, z1 - 1, WATER);
        fill(x0, G + 1, z0, x0, G + 1, z0, GLOW);
        fill(x1, G + 1, z1, x1, G + 1, z1, GLOW);
    }

    const f0 = footprint(ROOMS0);
    const f1 = footprint(ROOMS1);
    const L1 = G + FLOOR_H;
    const ROOF = G + 2 * FLOOR_H;

    buildLevel(ROOMS0, GAPS0, G, f0);
    // First floor slab over the whole ground floor, plus the balcony and terrace
    for (const key of f0) fill(Math.floor(key / 1000), L1, key % 1000, Math.floor(key / 1000), L1, key % 1000, QUARTZ);
    {
        const b = rectOf(BALCONY);
        fill(b.x0, L1, b.z0, b.x1, L1, b.z1, PAINT.peach);
        for (let x = b.x0; x <= b.x1; x++) set(x, L1 + 1, b.z0, GLASS);
        for (let z = b.z0; z < b.z1; z++) { set(b.x0, L1 + 1, z, GLASS); set(b.x1, L1 + 1, z, GLASS); }
        for (const x of [b.x0, b.x1]) fill(x, G + 1, b.z0, x, L1 - 1, b.z0, QUARTZ);
        const t = rectOf(TERRACE);
        fill(t.x0, L1, t.z0, t.x1, L1, t.z1, GRASS);
        for (let x = t.x0; x <= t.x1; x++) set(x, L1 + 1, t.z0, LEAVES);
        for (let z = t.z0; z <= t.z1; z++) set(t.x1, L1 + 1, z, LEAVES);
        for (let z = t.z0; z <= t.z1; z++) set(t.x0, L1 + 1, z, LEAVES);
        for (const [x, z] of [[t.x0, t.z0], [t.x1, t.z0], [t.x1, bz(310)]]) fill(x, G + 1, z, x, L1 - 1, z, QUARTZ);
        for (let i = 0; i < 6; i++) set(t.x0 + 2 + i * 2, L1 + 1, t.z0 + 2, i % 2 ? ROSE_BUSH : SUN_BUSH);
        fill(t.x0 + 5, L1 + 1, t.z0 + 8, t.x0 + 9, L1 + 1, t.z0 + 9, PLANKS); // a garden bench
        set(t.x0 + 7, L1 + 2, t.z0 + 12, GLOW);
    }
    // Room floors on the first floor sit on the slab
    buildLevel(ROOMS1, GAPS1, L1, f1);
    // The flat roof terrace with its parapet
    for (const key of f1) {
        const x = Math.floor(key / 1000), z = key % 1000;
        set(x, ROOF, z, PAINT.sandstone);
        const edge = !f1.has((x + 1) * 1000 + z) || !f1.has((x - 1) * 1000 + z) || !f1.has(x * 1000 + z + 1) || !f1.has(x * 1000 + z - 1);
        if (edge) set(x, ROOF + 1, z, QUARTZ);
    }

    // Lamps: a glowstone in the middle of every ceiling
    for (const [rooms, ceil] of [[ROOMS0, L1], [ROOMS1, ROOF]]) {
        for (const r of rooms) {
            const { x0, z0, x1, z1 } = rectOf(r);
            set(Math.floor((x0 + x1) / 2), ceil, Math.floor((z0 + z1) / 2), GLOW);
        }
    }

    /* The staircase: ground → first floor on the left, first floor → roof on the right. */
    {
        const s = rectOf(ROOMS0.find((r) => r.name === 'Staircase'));
        const ax = s.x0 + 1; // flight one: columns ax, ax+1
        const cx = s.x1 - 2; // flight two: columns cx, cx+1
        const zs = s.z0 + 2;
        for (let i = 0; i < FLOOR_H; i++) {
            fill(ax, G + 1, zs + i, ax + 1, G + 1 + i, zs + i, i === FLOOR_H - 1 ? QUARTZ : PLANKS);
        }
        fill(ax, L1, zs, ax + 1, L1, zs + FLOOR_H - 2, AIR);
        fill(ax, L1 + 1, zs - 1, ax + 1, L1 + 1, zs - 1, GLASS);
        fill(ax + 2, L1 + 1, zs, ax + 2, L1 + 1, zs + FLOOR_H - 2, GLASS);
        const ze = s.z1 - 2;
        for (let j = 0; j < FLOOR_H; j++) {
            fill(cx, L1 + 1, ze - j, cx + 1, L1 + 1 + j, ze - j, j === FLOOR_H - 1 ? QUARTZ : PLANKS);
        }
        fill(cx, ROOF, ze - FLOOR_H + 2, cx + 1, ROOF, ze, AIR);
        fill(cx - 1, ROOF + 1, ze - FLOOR_H + 2, cx - 1, ROOF + 1, ze + 1, GLASS);
        fill(cx + 2, ROOF + 1, ze - FLOOR_H + 2, cx + 2, ROOF + 1, ze + 1, GLASS);
        fill(cx, ROOF + 1, ze + 1, cx + 1, ROOF + 1, ze + 1, GLASS);
    }

    /* Furniture, room by room */
    const furnish = (r, base) => {
        const { x0, z0, x1, z1 } = rectOf(r);
        const y = base + 1;
        const bed = (x, z, color) => {
            fill(x, y, z, x + 1, y, z + 2, color);
            fill(x, y, z, x + 1, y, z, WOOL.white);
            fill(x - 1, y, z, x - 1, y, z, BOOKSHELF);
            set(x - 1, y + 1, z, GLOW);
        };
        const sofa = (x, z, len, color) => {
            fill(x, y, z, x + len - 1, y, z, color);
            fill(x, y + 1, z + 1, x + len - 1, y + 1, z + 1, color);
            fill(x, y, z + 1, x + len - 1, y, z + 1, color);
        };
        const tv = (x, z, len) => fill(x, y + 1, z, x + len - 1, y + 2, z, OBSIDIAN);
        switch (r.name) {
            case 'Living Hall':
                sofa(x0 + 4, z1 - 3, 7, WOOL.red);
                fill(x0 + 4, y, z1 - 6, x0 + 10, y, z1 - 6, DARK_PLANKS);
                tv(x0 + 5, z0 + 1, 5);
                fill(x0 + 5, y, z0 + 1, x0 + 9, y, z0 + 1, DARK_PLANKS);
                fill(x0 + 13, y, z0 + 5, x0 + 17, y, z0 + 9, WOOL.pink); // rug
                set(x0 + 1, y, z0 + 1, PUMPKIN);
                fill(x1 - 1, y, z0 + 3, x1 - 1, y + 2, z0 + 3, BOOKSHELF);
                fill(x1 - 1, y, z0 + 4, x1 - 1, y + 2, z0 + 4, BOOKSHELF);
                break;
            case 'Kitchen':
                fill(x0 + 1, y, z0 + 1, x1 - 1, y, z0 + 1, QUARTZ);
                fill(x1 - 1, y, z0 + 1, x1 - 1, y + 2, z0 + 1, WOOL.lightGray); // fridge
                set(x0 + 3, y, z0 + 1, OBSIDIAN); // hob
                fill(x0 + 5, y, z0 + 5, x0 + 8, y, z0 + 6, PLANKS); // dining table
                set(x0 + 6, y + 1, z0 + 5, CHOCOLATE);
                set(x0 + 7, y + 1, z0 + 6, FROSTING);
                break;
            case 'Toilet 1': case 'Toilet 2': case 'Bathroom 1': case 'Bathroom 2':
                fill(x0 + 1, y, z0 + 1, x0 + 3, y, z0 + 2, QUARTZ);
                fill(x0 + 2, y, z0 + 1, x0 + 2, y, z0 + 1, WATER);
                set(x1 - 1, y, z1 - 1, QUARTZ);
                break;
            case 'Gaming Room':
                for (let i = 0; i < 3; i++) {
                    fill(x0 + 2 + i * 3, y, z1 - 1, x0 + 2 + i * 3, y + 1, z1 - 1, OBSIDIAN);
                    set(x0 + 2 + i * 3, y + 1, z1 - 2, SEA_LANTERN);
                }
                fill(x0 + 5, y, z0 + 4, x0 + 9, y, z0 + 6, WOOL.green); // pool table
                tv(x1 - 6, z0 + 1, 5);
                sofa(x1 - 7, z0 + 9, 5, WOOL.purple);
                break;
            case 'Guest Bedroom':
                bed(x0 + 3, z0 + 2, WOOL.lightBlue);
                break;
            case 'Master Bedroom':
                fill(x0 + 6, y, z0 + 2, x0 + 9, y, z0 + 5, WOOL.pink); // a big double bed
                fill(x0 + 6, y, z0 + 2, x0 + 9, y, z0 + 2, WOOL.white);
                fill(x0 + 6, y + 1, z0 + 1, x0 + 9, y + 1, z0 + 1, DARK_PLANKS);
                for (const x of [x0 + 5, x0 + 10]) { set(x, y, z0 + 2, BOOKSHELF); set(x, y + 1, z0 + 2, GLOW); }
                tv(x0 + 6, z1 - 1, 4);
                fill(x0 + 1, y, z1 - 2, x0 + 1, y, z1 - 1, ROSE_BUSH);
                break;
            case 'Bedroom 3':
                bed(x0 + 4, z0 + 3, WOOL.cyan);
                fill(x1 - 2, y, z0 + 2, x1 - 1, y + 2, z0 + 2, BOOKSHELF);
                break;
            case 'Kids Bedroom':
                bed(x0 + 3, z0 + 2, WOOL.lime);
                bed(x0 + 8, z0 + 2, WOOL.yellow);
                set(x1 - 2, y, z1 - 2, HAY);
                break;
            case 'Closet':
                fill(x0 + 1, y, z0 + 1, x0 + 1, y + 2, z1 - 1, BOOKSHELF);
                fill(x1 - 1, y, z0 + 1, x1 - 1, y + 2, z1 - 3, BOOKSHELF);
                break;
            case 'Family Lounge':
                sofa(x0 + 2, z1 - 3, 6, WOOL.orange);
                tv(x0 + 3, z0 + 6, 4);
                break;
            default:
        }
    };
    for (const r of ROOMS0) furnish(r, G);
    for (const r of ROOMS1) furnish(r, L1);

    // Front garden: hedge, flowers and the path to the door
    {
        const fg = rectOf(OUT0[0]);
        for (let x = fg.x0; x <= fg.x1; x++) if (x < 109 || x > 114) set(x, G + 1, fg.z0, LEAVES);
        fill(110, G, 82, 113, G, bz(190) - 1, GRAVEL);
        for (let x = fg.x0 + 2; x < fg.x1 - 1; x += 3) {
            if (x >= 108 && x <= 115) continue;
            set(x, G + 1, fg.z0 + 2, x % 2 ? ROSE_BUSH : SUN_BUSH);
        }
        // a blocky car in the parking
        const p = rectOf(OUT0[1]);
        fill(p.x0 + 4, G + 1, p.z0 + 4, p.x0 + 6, G + 1, p.z0 + 9, WOOL.red);
        fill(p.x0 + 4, G + 2, p.z0 + 5, p.x0 + 6, G + 2, p.z0 + 7, GLASS);
        for (const [dx, dz] of [[3, 5], [7, 5], [3, 8], [7, 8]]) set(p.x0 + dx, G + 1, p.z0 + dz, WOOL.black);
    }

    /* Trees, placed on a jittered grid so they never clump */
    const r = rng(1234);
    const busy = (x, z) =>
        (x > 94 && x < 160 && z > 78 && z < 154) || // house and road
        (z > 79 && z < 91) ||
        (x > 172 && x < 200 && z > 96 && z < 124) || // spleef
        (x > 68 && x < 90 && z > 94 && z < 132) || // boards
        (x > 160 && x < 178 && z > 136 && z < 154) || // chocolate house
        (x > 132 && x < 152 && z > 70 && z < 82) || // heart
        (x > OFFROAD.x0 - 4 && x < OFFROAD.x1 + 4 && z > OFFROAD.z0 - 4 && z < OFFROAD.z1 + 4) || // off-road park
        lakeDepth(x, z) > 0 || lakeDepth(x + 3, z) > 0 || lakeDepth(x - 3, z) > 0;
    const tree = (x, z, cherry) => {
        const h = terrainHeight(x, z);
        if (get(x, h, z) !== GRASS) return;
        const t = 4 + Math.floor(r() * 2);
        const leaf = cherry ? CHERRY_LEAVES : LEAVES;
        for (let dy = t - 2; dy <= t + 1; dy++) {
            const rad = dy > t ? 1 : 2;
            for (let dz = -rad; dz <= rad; dz++)
                for (let dx = -rad; dx <= rad; dx++) {
                    if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy > t - 1 || r() < 0.5)) continue;
                    if (get(x + dx, h + dy, z + dz) === AIR) set(x + dx, h + dy, z + dz, leaf);
                }
        }
        fill(x, h + 1, z, x, h + t, z, LOG);
    };
    for (let gz = 4; gz < SZ - 4; gz += 8) {
        for (let gx = 4; gx < SX - 4; gx += 8) {
            const x = gx + Math.floor(r() * 5), z = gz + Math.floor(r() * 5);
            const roll = r();
            if (busy(x, z)) continue;
            const inFlat = x > FLAT.x0 && x < FLAT.x1 && z > FLAT.z0 && z < FLAT.z1;
            if (roll < (inFlat ? 0.3 : 0.55)) tree(x, z, r() < 0.3);
            else if (inFlat && roll < 0.45) set(x, G + 1, z, r() < 0.5 ? ROSE_BUSH : SUN_BUSH);
        }
    }
    // Garden trees: cherry blossoms in the front and back
    tree(104, 94, true);
    tree(120, 95, true);
    tree(104, 144, true);
    tree(116, 145, false);

    /* A giant glowing heart beside the road, for her */
    {
        const art = [
            '.XX...XX.',
            'XXXX.XXXX',
            'XXXXXXXXX',
            'XXXXXXXXX',
            '.XXXXXXX.',
            '..XXXXX..',
            '...XXX...',
            '....X....',
        ];
        art.forEach((row, i) => [...row].forEach((c, j) => c === 'X' && set(137 + j, G + 9 - i, 76, HEART)));
        fill(140, G + 1, 76, 142, G + 1, 76, QUARTZ);
    }

    /* The Chocolate House */
    {
        const x0 = 165, z0 = 141, x1 = 173, z1 = 149;
        fill(x0, G, z0, x1, G, z1, CHECKER);
        for (let y = G + 1; y <= G + 4; y++) {
            for (let x = x0; x <= x1; x++) { set(x, y, z0, CHOCOLATE); set(x, y, z1, CHOCOLATE); }
            for (let z = z0; z <= z1; z++) { set(x0, y, z, CHOCOLATE); set(x1, y, z, CHOCOLATE); }
        }
        fill(168, G + 1, z0, 170, G + 3, z0, AIR);
        fill(x0 + 2, G + 2, z1, x0 + 3, G + 3, z1, GLASS);
        for (let k = 0; k <= 4; k++) fill(x0 - 1 + k, G + 5 + k, z0 - 1 + k, x1 + 1 - k, G + 5 + k, z1 + 1 - k, FROSTING);
        fill(x0 + 1, G + 1, z1 - 1, x1 - 1, G + 2, z1 - 1, CHOCOLATE); // shelves
        fill(169, G + 1, 145, 169, G + 3, 145, CHOCOLATE); // the fountain
        set(169, G + 4, 145, GOLD);
        set(x0 + 1, G + 4, z0 + 1, GLOW);
    }

    /* Spleef: a snow floor over a cold pool */
    {
        const { x0, z0, x1, z1, y } = SPLEEF;
        fill(x0 - 1, y - 7, z0 - 1, x1 + 1, y, z1 + 1, QUARTZ);
        fill(x0, y - 6, z0, x1, y - 1, z1, AIR);
        fill(x0, y - 6, z0, x1, y - 5, z1, WATER);
        fill(x0, y, z0, x1, y, z1, SNOW);
        for (let x = x0 - 1; x <= x1 + 1; x++) { fill(x, y + 1, z0 - 1, x, y + 2, z0 - 1, GLASS); fill(x, y + 1, z1 + 1, x, y + 2, z1 + 1, GLASS); }
        for (let z = z0 - 1; z <= z1 + 1; z++) { fill(x0 - 1, y + 1, z, x0 - 1, y + 2, z, GLASS); fill(x1 + 1, y + 1, z, x1 + 1, y + 2, z, GLASS); }
        for (const [x, z] of [[x0 - 1, z0 - 1], [x1 + 1, z0 - 1], [x0 - 1, z1 + 1], [x1 + 1, z1 + 1]]) fill(x, y + 1, z, x, y + 3, z, GLOW);
    }

    /* Tic-tac-toe board: white cells, black lines, a gold rim */
    {
        fill(74, G, 98, 86, G, 110, GOLD);
        fill(75, G, 99, 85, G, 109, WOOL.black);
        for (let r2 = 0; r2 < 3; r2++)
            for (let c = 0; c < 3; c++) fill(75 + c * 4, G, 99 + r2 * 4, 77 + c * 4, G, 101 + r2 * 4, WOOL.white);
    }

    /* Memory board: sixteen purple card spots */
    {
        fill(72, G, 116, 84, G, 128, GOLD);
        fill(73, G, 117, 83, G, 127, WOOL.white);
        for (let r2 = 0; r2 < 4; r2++)
            for (let c = 0; c < 4; c++) fill(73 + c * 3, G, 117 + r2 * 3, 74 + c * 3, G, 118 + r2 * 3, WOOL.purple);
    }

    /* The off-road park */
    {
        const { x0, z0, x1, z1 } = OFFROAD;
        const r2 = rng(99);
        for (let z = z0; z <= z1; z++)
            for (let x = x0; x <= x1; x++) set(x, G, z, r2() < 0.25 ? GRAVEL : r2() < 0.1 ? GRASS : DIRT);
        // Ramps: four steps up, then a drop — hit them fast to fly
        const ramp = (x, z, dir, width = 5, height = 4) => {
            for (let i = 0; i < height; i++)
                for (let w = 0; w < width; w++) {
                    const rx = dir === 'x' ? x + i : x + w;
                    const rz = dir === 'x' ? z + w : z + i;
                    fill(rx, G + 1, rz, rx, G + 1 + i, rz, i === height - 1 ? WOOL.yellow : WOOL.orange);
                }
        };
        ramp(172, 44, 'x');
        ramp(196, 44, 'x', 5, 3);
        ramp(186, 58, 'z', 6, 4);
        ramp(204, 64, 'z', 5, 2);
        // Dirt mounds to bounce over
        const mound = (cx, cz, rad, h) => {
            for (let z = cz - rad; z <= cz + rad; z++)
                for (let x = cx - rad; x <= cx + rad; x++) {
                    const d = Math.hypot(x - cx, z - cz) / rad;
                    if (d > 1) continue;
                    const top = Math.round((1 - d * d) * h);
                    if (top > 0) fill(x, G + 1, z, x, G + top, z, top === Math.round(h) ? GRASS : DIRT);
                }
        };
        mound(170, 68, 5, 3);
        mound(210, 40, 4, 2);
        mound(178, 36, 3, 2);
        // A muddy splash pit
        fill(194, G - 1, 70, 202, G, 76, WATER);
        fill(194, G - 2, 70, 202, G - 2, 76, DIRT);
        // Hay bale and pumpkin markers around the edge
        for (let x = x0; x <= x1; x += 6) { set(x, G + 1, z0, HAY); set(x, G + 1, z1, x % 12 ? HAY : PUMPKIN); }
        for (let z = z0; z <= z1; z += 6) { set(x1, G + 1, z, HAY); if (z < 80 && z > z0 + 2) set(x0, G + 1, z, z % 12 ? PUMPKIN : HAY); }
    }

    /* The sky parkour course */
    const colours = Object.values(WOOL).filter((id) => id !== WOOL.black && id !== WOOL.gray);
    PARKOUR.pads.forEach((p, i) => {
        const id = p.kind === 'start' ? QUARTZ : p.kind === 'checkpoint' ? GOLD : p.kind === 'finish' ? EMERALD : colours[i % colours.length];
        fill(p.x, p.y, p.z, p.x + p.size - 1, p.y, p.z + p.size - 1, id);
        if (p.kind !== 'pad') set(p.x, p.y + 1, p.z, GLOW);
    });

    // A couple of hay bales and pumpkins by the board area to make it feel lived in
    set(70, G + 1, 112, HAY);
    set(70, G + 1, 113, PUMPKIN);
    set(88, G + 1, 99, COBBLE);

    return w;
}

/** Top-most solid block at a column, or -1. */
export function surfaceY(w, x, z) {
    for (let y = SY - 1; y >= 0; y--) {
        const id = w[idx(x, y, z)];
        if (id !== AIR && BLOCKS[id].solid) return y;
    }
    return -1;
}
