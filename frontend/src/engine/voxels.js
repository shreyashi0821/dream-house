import * as THREE from 'three';
import { BLOCKS, AIR } from '@shared/blocks.js';
import { generateWorld, idx, inBounds, SX, SY, SZ, fromIdx } from '@shared/world.js';
import { getAtlas } from './textures';

/**
 * The block world in the browser: the data, its chunk meshes and the voxel
 * raycast. Chunks are 16³; editing a block remeshes only its chunk (and a
 * neighbour when the block sits on the edge).
 */

export const CS = 16;
const NCX = SX / CS, NCY = SY / CS, NCZ = SZ / CS;

const SOLID = new Uint8Array(BLOCKS.length);
const OPAQUE = new Uint8Array(BLOCKS.length);
const TRANSP = new Uint8Array(BLOCKS.length);
const LIGHT = new Uint8Array(BLOCKS.length);
BLOCKS.forEach((b, i) => {
    SOLID[i] = b.solid ? 1 : 0;
    OPAQUE[i] = b.solid && !b.transparent ? 1 : 0;
    TRANSP[i] = b.transparent ? 1 : 0;
    LIGHT[i] = b.light ? 1 : 0;
});

/* Faces: direction, corners (each one a unit-cube corner), uvs per corner and
   a flat shade so the sides read as different planes even at noon. */
const FACES = [
    { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], tile: 1, shade: 0.78 },
    { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], uv: [[0, 1], [0, 0], [1, 1], [1, 0]], tile: 1, shade: 0.78 },
    { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], uv: [[1, 0], [0, 0], [1, 1], [0, 1]], tile: 2, shade: 0.55 },
    { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], uv: [[1, 1], [0, 1], [1, 0], [0, 0]], tile: 0, shade: 1.0 },
    { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], tile: 1, shade: 0.88 },
    { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], uv: [[0, 0], [1, 0], [0, 1], [1, 1]], tile: 1, shade: 0.88 },
];
const AO = [0.42, 0.62, 0.8, 1.0];

export class VoxelWorld {
    constructor() {
        this.data = generateWorld();
        this.meshes = new Map();
        this.dirty = new Set();
        this.group = new THREE.Group();
        const { texture } = getAtlas();
        this.materials = {
            opaque: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
            glow: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
            transparent: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        };
    }

    get(x, y, z) {
        return inBounds(x, y, z) ? this.data[idx(x, y, z)] : AIR;
    }
    solid(x, y, z) {
        if (y < 0) return true;
        return SOLID[this.get(x, y, z)] === 1;
    }

    /** Change one block and mark the chunks that can see it. */
    set(x, y, z, id) {
        if (!inBounds(x, y, z)) return false;
        const i = idx(x, y, z);
        if (this.data[i] === id) return false;
        this.data[i] = id;
        const cx = Math.floor(x / CS), cy = Math.floor(y / CS), cz = Math.floor(z / CS);
        this.dirty.add(this.key(cx, cy, cz));
        const lx = x % CS, ly = y % CS, lz = z % CS;
        // Neighbours too: their faces and ambient occlusion depend on this block.
        if (lx === 0) this.dirty.add(this.key(cx - 1, cy, cz));
        if (lx === CS - 1) this.dirty.add(this.key(cx + 1, cy, cz));
        if (ly === 0) this.dirty.add(this.key(cx, cy - 1, cz));
        if (ly === CS - 1) this.dirty.add(this.key(cx, cy + 1, cz));
        if (lz === 0) this.dirty.add(this.key(cx, cy, cz - 1));
        if (lz === CS - 1) this.dirty.add(this.key(cx, cy, cz + 1));
        return true;
    }
    setIndex(i, id) {
        const [x, y, z] = fromIdx(i);
        return this.set(x, y, z, id);
    }

    key(cx, cy, cz) {
        if (cx < 0 || cy < 0 || cz < 0 || cx >= NCX || cy >= NCY || cz >= NCZ) return -1;
        return (cy * NCZ + cz) * NCX + cx;
    }

    buildAll() {
        for (let cy = 0; cy < NCY; cy++) for (let cz = 0; cz < NCZ; cz++) for (let cx = 0; cx < NCX; cx++) this.buildChunk(cx, cy, cz);
        this.dirty.clear();
    }

    /** Remesh up to `budget` dirty chunks; called every frame. */
    flush(budget = 8) {
        for (const k of this.dirty) {
            this.dirty.delete(k);
            if (k < 0) continue;
            const cx = k % NCX, cz = Math.floor(k / NCX) % NCZ, cy = Math.floor(k / (NCX * NCZ));
            this.buildChunk(cx, cy, cz);
            if (--budget <= 0) break;
        }
    }

    buildChunk(cx, cy, cz) {
        const k = this.key(cx, cy, cz);
        const old = this.meshes.get(k);
        if (old) {
            for (const m of old) {
                this.group.remove(m);
                m.geometry.dispose();
            }
            this.meshes.delete(k);
        }
        const geos = this.mesh(cx, cy, cz);
        const made = [];
        for (const [kind, geo] of Object.entries(geos)) {
            if (!geo) continue;
            const m = new THREE.Mesh(geo, this.materials[kind]);
            m.matrixAutoUpdate = false;
            if (kind === 'transparent') m.renderOrder = 1;
            this.group.add(m);
            made.push(m);
        }
        if (made.length) this.meshes.set(k, made);
    }

    mesh(cx, cy, cz) {
        const { tileOf, uv } = getAtlas();
        const out = { opaque: newBuf(), glow: newBuf(), transparent: newBuf() };
        const d = this.data;
        const x0 = cx * CS, y0 = cy * CS, z0 = cz * CS;
        const occl = (x, y, z) => (inBounds(x, y, z) ? OPAQUE[d[idx(x, y, z)]] : 0);

        for (let y = y0; y < y0 + CS; y++) {
            for (let z = z0; z < z0 + CS; z++) {
                let i = idx(x0, y, z);
                for (let x = x0; x < x0 + CS; x++, i++) {
                    const id = d[i];
                    if (id === AIR) continue;
                    const transp = TRANSP[id] === 1;
                    const buf = transp ? out.transparent : LIGHT[id] ? out.glow : out.opaque;
                    for (let f = 0; f < 6; f++) {
                        const F = FACES[f];
                        const nx = x + F.dir[0], ny = y + F.dir[1], nz = z + F.dir[2];
                        const n = inBounds(nx, ny, nz) ? d[idx(nx, ny, nz)] : AIR;
                        // Hidden behind anything opaque, or between two of the same see-through block.
                        if (n !== AIR && (OPAQUE[n] || n === id)) continue;
                        if (ny < 0) continue;
                        const [u0, v0, u1, v1] = uv(tileOf[id][F.tile]);
                        const base = buf.pos.length / 3;
                        const ao = [0, 0, 0, 0];
                        for (let c = 0; c < 4; c++) {
                            const cr = F.corners[c];
                            buf.pos.push(x + cr[0], y + cr[1], z + cr[2]);
                            buf.uv.push(F.uv[c][0] ? u1 : u0, F.uv[c][1] ? v1 : v0);
                            // Ambient occlusion from the three blocks around this corner
                            let s1 = 0, s2 = 0, cc = 0;
                            if (!transp) {
                                const t = [];
                                for (let a = 0; a < 3; a++) if (F.dir[a] === 0) t.push(a);
                                const o1 = [0, 0, 0], o2 = [0, 0, 0];
                                o1[t[0]] = cr[t[0]] ? 1 : -1;
                                o2[t[1]] = cr[t[1]] ? 1 : -1;
                                s1 = occl(nx + o1[0], ny + o1[1], nz + o1[2]);
                                s2 = occl(nx + o2[0], ny + o2[1], nz + o2[2]);
                                cc = occl(nx + o1[0] + o2[0], ny + o1[1] + o2[1], nz + o1[2] + o2[2]);
                            }
                            const a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
                            ao[c] = a;
                            const l = AO[a] * F.shade;
                            buf.col.push(l, l, l);
                        }
                        if (ao[0] + ao[3] > ao[1] + ao[2]) buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
                        else buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
                    }
                }
            }
        }
        return { opaque: toGeo(out.opaque), glow: toGeo(out.glow), transparent: toGeo(out.transparent) };
    }

    /**
     * Walks the grid from `origin` along `dir` (Amanatides & Woo) and returns
     * the first block that is not air or water, with the face it was hit on.
     */
    raycast(origin, dir, maxDist = 6) {
        let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
        const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
        const tdx = sx ? Math.abs(1 / dir.x) : Infinity, tdy = sy ? Math.abs(1 / dir.y) : Infinity, tdz = sz ? Math.abs(1 / dir.z) : Infinity;
        let tmx = sx > 0 ? (x + 1 - origin.x) * tdx : sx < 0 ? (origin.x - x) * tdx : Infinity;
        let tmy = sy > 0 ? (y + 1 - origin.y) * tdy : sy < 0 ? (origin.y - y) * tdy : Infinity;
        let tmz = sz > 0 ? (z + 1 - origin.z) * tdz : sz < 0 ? (origin.z - z) * tdz : Infinity;
        let n = [0, 0, 0], t = 0;
        while (t <= maxDist) {
            const id = this.get(x, y, z);
            if (id !== AIR && !BLOCKS[id].liquid) return { x, y, z, id, normal: n, dist: t };
            if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
            else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
            else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
        }
        return null;
    }

    setNight(night) {
        const c = night ? 0.32 : 1;
        this.materials.opaque.color.setScalar(c);
        this.materials.transparent.color.setScalar(night ? 0.45 : 1);
    }

    dispose() {
        for (const list of this.meshes.values()) for (const m of list) m.geometry.dispose();
        Object.values(this.materials).forEach((m) => m.dispose());
    }
}

const newBuf = () => ({ pos: [], uv: [], col: [], idx: [] });
function toGeo(b) {
    if (!b.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setIndex(b.idx);
    g.computeBoundingSphere();
    return g;
}
