import * as THREE from 'three';
import { BLOCKS } from '@shared/blocks.js';

/**
 * Paints every block texture into one 16×16-per-tile atlas at startup.
 * No image files: each pattern below is a few lines of pixel drawing, seeded
 * so a block looks the same on every machine.
 */

const T = 16;
const COLS = 16;

const hex = (c) => {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const shade = ([r, g, b], f) => [clamp(r * f), clamp(g * f), clamp(b * f)];
const mix = (a, b, t) => [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];

function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}
const strSeed = (str) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Paint one tile into an ImageData-like pixel buffer. */
function paint(style, color, rand) {
    const px = new Uint8ClampedArray(T * T * 4);
    const base = hex(color);
    const put = (x, y, c, a = 255) => {
        if (x < 0 || y < 0 || x >= T || y >= T) return;
        const i = (y * T + x) * 4;
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a;
    };
    const noiseFill = (c, amt, a = 255) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, shade(c, 1 - amt / 2 + rand() * amt), a);
    };
    const speckle = (c, n) => {
        for (let k = 0; k < n; k++) put(Math.floor(rand() * T), Math.floor(rand() * T), c);
    };
    const border = (c, a = 255) => {
        for (let i = 0; i < T; i++) { put(i, 0, c, a); put(i, T - 1, c, a); put(0, i, c, a); put(T - 1, i, c, a); }
    };
    const DIRT = hex('#8b5a2b');
    const GRASS = hex('#6cbf4a');

    switch (style) {
        case 'grass_top':
            noiseFill(GRASS, 0.3);
            speckle(shade(GRASS, 0.75), 30);
            speckle(shade(GRASS, 1.15), 20);
            break;
        case 'grass_side':
            noiseFill(DIRT, 0.3);
            speckle(shade(DIRT, 0.7), 18);
            for (let x = 0; x < T; x++) {
                const h = 3 + Math.floor(rand() * 3);
                for (let y = 0; y < h; y++) put(x, y, shade(GRASS, 0.85 + rand() * 0.3));
            }
            break;
        case 'dirt':
            noiseFill(base, 0.3);
            speckle(shade(base, 0.65), 22);
            speckle(shade(base, 1.2), 10);
            break;
        case 'stone':
            noiseFill(base, 0.18);
            for (let k = 0; k < 6; k++) {
                const x = Math.floor(rand() * T), y = Math.floor(rand() * T), len = 2 + Math.floor(rand() * 4);
                for (let i = 0; i < len; i++) put(x + i, y, shade(base, 0.78));
            }
            break;
        case 'cobble': {
            noiseFill(shade(base, 0.9), 0.25);
            const cells = [];
            for (let k = 0; k < 9; k++) cells.push([rand() * T, rand() * T]);
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) {
                    const d = cells.map(([cx, cy]) => Math.hypot(cx - x, cy - y)).sort((a, b) => a - b);
                    if (d[1] - d[0] < 1.2) put(x, y, shade(base, 0.55));
                    else if (d[0] < 2) put(x, y, shade(base, 1.15));
                }
            break;
        }
        case 'sand':
            noiseFill(base, 0.12);
            speckle(shade(base, 0.85), 25);
            break;
        case 'gravel':
            noiseFill(base, 0.2);
            for (let k = 0; k < 40; k++) {
                const c = shade(base, 0.6 + rand() * 0.7);
                const x = Math.floor(rand() * T), y = Math.floor(rand() * T);
                put(x, y, c); put(x + 1, y, c);
            }
            break;
        case 'water':
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) {
                    const w = Math.sin((x + y * 0.5) * 0.8) * 0.08;
                    put(x, y, shade(base, 0.9 + w + rand() * 0.1), 170);
                }
            break;
        case 'ice':
            noiseFill(base, 0.1, 190);
            for (let k = 0; k < 3; k++) {
                let x = Math.floor(rand() * T), y = Math.floor(rand() * T);
                for (let i = 0; i < 6; i++) { put(x, y, [240, 250, 255], 220); x += rand() < 0.5 ? 1 : 0; y += 1; }
            }
            break;
        case 'log_top': {
            const c = hex('#b8875a');
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) {
                    const r = Math.hypot(x - 7.5, y - 7.5);
                    put(x, y, Math.floor(r) % 3 === 0 ? shade(c, 0.75) : shade(c, 0.95 + rand() * 0.1));
                }
            border(base);
            break;
        }
        case 'log_side':
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) put(x, y, shade(base, x % 4 === 0 ? 0.7 : 0.9 + rand() * 0.2));
            break;
        case 'leaves':
            noiseFill(base, 0.35);
            speckle(shade(base, 0.6), 35);
            speckle(shade(base, 1.25), 15);
            break;
        case 'flowers_red':
        case 'flowers_yellow': {
            noiseFill(base, 0.35);
            speckle(shade(base, 0.6), 25);
            const f = style === 'flowers_red' ? hex('#ff3b5c') : hex('#ffd23f');
            for (let k = 0; k < 6; k++) {
                const x = 1 + Math.floor(rand() * 13), y = 1 + Math.floor(rand() * 13);
                put(x, y, f); put(x + 1, y, f); put(x, y + 1, f); put(x + 1, y + 1, shade(f, 0.8));
            }
            break;
        }
        case 'planks':
            for (let y = 0; y < T; y++) {
                const row = Math.floor(y / 4);
                const off = row % 2 ? 8 : 0;
                for (let x = 0; x < T; x++) {
                    let c = shade(base, 0.92 + rand() * 0.12);
                    if (y % 4 === 3) c = shade(base, 0.62);
                    if ((x + off) % 16 === 0) c = shade(base, 0.7);
                    put(x, y, c);
                }
            }
            break;
        case 'books': {
            const P = hex('#c09359');
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) put(x, y, y < 2 || y > 13 || y === 7 || y === 8 ? shade(P, 0.8 + rand() * 0.2) : [40, 30, 20]);
            const spines = ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#e84393'];
            for (const top of [2, 9]) {
                for (let x = 1; x < 15; x += 2) {
                    const c = hex(spines[Math.floor(rand() * spines.length)]);
                    const h = 4 + Math.floor(rand() * 2);
                    for (let y = top + (5 - h); y < top + 5; y++) { put(x, y, c); put(x + 1, y, shade(c, 0.8)); }
                }
            }
            break;
        }
        case 'glass':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, base, 40);
            border([255, 255, 255], 230);
            for (let i = 3; i < 8; i++) put(i, 11 - i, [255, 255, 255], 200);
            for (let i = 5; i < 9; i++) put(i + 3, 14 - i, [255, 255, 255], 160);
            break;
        case 'brick':
            for (let y = 0; y < T; y++) {
                const row = Math.floor(y / 4);
                for (let x = 0; x < T; x++) {
                    const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 0;
                    put(x, y, mortar ? [200, 190, 180] : shade(base, 0.88 + rand() * 0.2));
                }
            }
            break;
        case 'quartz':
            noiseFill(base, 0.05);
            border(shade(base, 0.9));
            break;
        case 'snow':
            noiseFill(base, 0.05);
            speckle([220, 235, 250], 14);
            break;
        case 'gold':
            noiseFill(base, 0.08);
            for (let i = 0; i < T; i++) { put(i, 0, shade(base, 1.3)); put(0, i, shade(base, 1.3)); put(i, T - 1, shade(base, 0.7)); put(T - 1, i, shade(base, 0.7)); }
            for (let i = 2; i < 6; i++) put(i, 2, [255, 255, 255]);
            put(2, 3, [255, 255, 255]);
            speckle(shade(base, 1.2), 8);
            break;
        case 'glow':
            noiseFill(base, 0.25);
            for (let k = 0; k < 10; k++) {
                const x = Math.floor(rand() * 14), y = Math.floor(rand() * 14);
                put(x, y, [255, 255, 230]); put(x + 1, y, [255, 250, 200]); put(x, y + 1, [255, 250, 200]);
            }
            speckle(shade(base, 0.7), 12);
            break;
        case 'tnt_side':
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) put(x, y, y >= 5 && y <= 10 ? [240, 240, 240] : shade(base, x % 4 === 0 ? 0.8 : 1));
            for (const [x, y] of [[3, 7], [4, 7], [5, 7], [4, 8], [4, 9], [7, 7], [7, 8], [7, 9], [8, 8], [9, 7], [9, 8], [9, 9], [11, 7], [12, 7], [13, 7], [12, 8], [12, 9]]) put(x, y, [30, 30, 30]);
            break;
        case 'tnt_top':
            noiseFill(base, 0.1);
            for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) put(x, y, [40, 40, 40]);
            break;
        case 'choc':
            for (let y = 0; y < T; y++)
                for (let x = 0; x < T; x++) {
                    const edge = x % 8 === 0 || y % 8 === 0;
                    const hi = x % 8 === 1 || y % 8 === 1;
                    put(x, y, edge ? shade(base, 0.7) : hi ? shade(base, 1.3) : shade(base, 0.97 + rand() * 0.06));
                }
            break;
        case 'frost': {
            noiseFill(base, 0.08);
            const sprinkles = ['#ffffff', '#ffd23f', '#3d8be0', '#3ccf6e', '#ff3b5c'];
            for (let k = 0; k < 14; k++) put(Math.floor(rand() * T), Math.floor(rand() * T), hex(sprinkles[k % sprinkles.length]));
            break;
        }
        case 'frost_side': {
            const C = hex('#5b3420');
            for (let x = 0; x < T; x++) {
                const drip = 4 + Math.floor(rand() * 5);
                for (let y = 0; y < T; y++) put(x, y, y < drip ? shade(base, 0.95 + rand() * 0.1) : shade(C, 0.9 + rand() * 0.15));
            }
            break;
        }
        case 'pumpkin_side':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, shade(base, x % 4 === 0 ? 0.75 : 0.95 + rand() * 0.1));
            break;
        case 'pumpkin_top':
            noiseFill(base, 0.12);
            for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) put(x, y, hex('#5a7a2a'));
            break;
        case 'melon':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, shade(base, (x + Math.floor(y / 3)) % 4 === 0 ? 1.35 : 0.9 + rand() * 0.1));
            break;
        case 'hay_top':
            noiseFill(base, 0.2);
            border(shade(base, 0.7));
            break;
        case 'hay_side':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, y === 4 || y === 11 ? hex('#8a5a2b') : shade(base, 0.85 + rand() * 0.3));
            break;
        case 'wool':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, shade(base, (x + y) % 3 === 0 ? 0.9 : 0.97 + rand() * 0.06));
            break;
        case 'plain':
            noiseFill(base, 0.04);
            border(shade(base, 0.9));
            break;
        case 'tile':
            noiseFill(base, 0.05);
            for (let i = 0; i < T; i++) { put(i, 0, [250, 250, 250]); put(0, i, [250, 250, 250]); put(i, 8, [250, 250, 250]); put(8, i, [250, 250, 250]); }
            for (const [x, y] of [[2, 2], [10, 2], [2, 10], [10, 10]]) put(x, y, shade(base, 1.15));
            break;
        case 'carpet':
            noiseFill(base, 0.1);
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) put(x, y, shade(base, 1.2));
            break;
        case 'checker':
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, (x < 8) !== (y < 8) ? shade(base, 0.98 + rand() * 0.04) : [250, 250, 250]);
            break;
        case 'road':
            noiseFill(base, 0.15);
            speckle(shade(base, 1.4), 10);
            break;
        case 'road_line':
            noiseFill(base, 0.15);
            for (let y = 6; y < 10; y++) for (let x = 0; x < T; x++) put(x, y, hex('#ffd23f'));
            break;
        case 'heart': {
            noiseFill(base, 0.1);
            const art = ['..........', '..XX..XX..', '.XXXXXXXX.', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'];
            art.forEach((row, j) => [...row].forEach((c, i) => c === 'X' && put(i + 3, j + 4, [255, 255, 255])));
            border(shade(base, 0.8));
            break;
        }
        default:
            noiseFill(base, 0.1);
    }
    return px;
}

/* ── The atlas ──────────────────────────────────────────────────────── */

let atlas = null;

function build() {
    const keys = new Map();
    const tileOf = [];
    for (const b of BLOCKS) {
        const faces = [b.top, b.side, b.bottom].map((style) => {
            if (style === 'none') return 0;
            const key = `${style}|${b.color}`;
            if (!keys.has(key)) keys.set(key, keys.size);
            return keys.get(key);
        });
        tileOf.push(faces);
    }
    const rows = Math.ceil(keys.size / COLS);
    const W = COLS * T;
    const H = Math.max(T, 2 ** Math.ceil(Math.log2(rows * T)));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    for (const [key, n] of keys) {
        const [style, color] = key.split('|');
        const px = paint(style, color, seeded(strSeed(key)));
        g.putImageData(new ImageData(px, T, T), (n % COLS) * T, Math.floor(n / COLS) * T);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const e = 0.02 / W; // a hair of inset so neighbouring tiles never bleed in
    const uv = (n) => {
        const c = n % COLS, r = Math.floor(n / COLS);
        return [c * T / W + e, 1 - ((r + 1) * T) / H + e, ((c + 1) * T) / W - e, 1 - (r * T) / H - e];
    };
    return { canvas, texture, tileOf, uv, W, H };
}

export function getAtlas() {
    if (!atlas) atlas = build();
    return atlas;
}

/** A small isometric picture of a block, for the hotbar and inventory. */
const icons = new Map();
export function blockIcon(id) {
    if (icons.has(id)) return icons.get(id);
    const { canvas: src, tileOf } = getAtlas();
    const [top, side] = tileOf[id];
    const S = 48;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const draw = (tile, m, dark) => {
        g.setTransform(...m);
        g.drawImage(src, (tile % COLS) * T, Math.floor(tile / COLS) * T, T, T, 0, 0, T, T);
        if (dark) {
            g.fillStyle = `rgba(0,0,0,${dark})`;
            g.fillRect(0, 0, T, T);
        }
    };
    draw(top, [20 / 16, -10 / 16, 20 / 16, 10 / 16, 4, 14], 0);
    draw(side, [20 / 16, 10 / 16, 0, 22 / 16, 4, 14], 0.22);
    draw(side, [20 / 16, -10 / 16, 0, 22 / 16, 24, 24], 0.4);
    const url = c.toDataURL();
    icons.set(id, url);
    return url;
}
