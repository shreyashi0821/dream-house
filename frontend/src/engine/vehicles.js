import * as THREE from 'three';
import { WATER } from '@shared/blocks.js';
import { SX, SZ } from '@shared/world.js';

/**
 * Blocky off-road vehicles and their physics.
 *
 * Only the driver's browser runs `drive()`; everyone else interpolates the
 * positions it streams. A car rides on the highest of its four wheels, climbs
 * any step lower than its `climb`, and keeps its vertical speed when the
 * ground drops away — which is what turns a ramp into a jump.
 */

export const KINDS = {
    jeep: { name: 'Off-road Jeep', w: 2.6, l: 4.4, h: 2.6, wheel: 0.62, clear: 0.45, max: 20, boost: 30, rev: 8, accel: 15, turn: 1.9, climb: 1.3 },
    monster: { name: 'Monster Truck', w: 3.4, l: 5.2, h: 3.6, wheel: 1.05, clear: 1.1, max: 18, boost: 27, rev: 7, accel: 13, turn: 1.6, climb: 2.25 },
    buggy: { name: 'Love Buggy', w: 2.2, l: 3.6, h: 2.2, wheel: 0.5, clear: 0.35, max: 26, boost: 38, rev: 9, accel: 21, turn: 2.4, climb: 1.15 },
};

const GRAVITY = 30;
const lambert = (color, emissive) => new THREE.MeshLambertMaterial({ color, ...(emissive ? { emissive } : {}) });
const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
};

/** Builds the model. Its origin is on the ground at the centre; the front faces -z. */
function buildModel(kind, color) {
    const k = KINDS[kind];
    const root = new THREE.Group();
    const body = new THREE.Group(); // tilts with the terrain
    root.add(body);
    const paint = lambert(color);
    const dark = lambert('#26222e');
    const chrome = lambert('#d8dde6');
    const glass = new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.55 });
    const light = lambert('#fff6c2', '#fff0a0');
    const red = lambert('#ff3b3b', '#801010');
    const { w, l, wheel, clear } = k;
    const base = clear + wheel * 0.6;

    // Wheels: chunky 8-sided tyres with a hub
    const wheels = [];
    const tyre = new THREE.CylinderGeometry(wheel, wheel, wheel * 0.75, 8).rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(wheel * 0.45, wheel * 0.45, wheel * 0.8, 6).rotateZ(Math.PI / 2);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * (w / 2 - wheel * 0.25), wheel, sz * (l / 2 - wheel * 0.9));
        const spin = new THREE.Group();
        spin.add(new THREE.Mesh(tyre, dark), new THREE.Mesh(hub, chrome));
        pivot.add(spin);
        body.add(pivot);
        wheels.push({ pivot, spin, front: sz < 0 });
    }

    if (kind === 'jeep') {
        body.add(box(w - 0.3, 0.9, l, paint, 0, base + 0.45, 0));
        body.add(box(w - 0.5, 0.15, l * 0.42, dark, 0, base + 0.95, l * 0.18)); // seats floor
        body.add(box(w - 0.3, 0.6, 0.12, glass, 0, base + 1.25, -l * 0.12)); // windscreen
        for (const sx of [-1, 1]) for (const sz of [-0.12, 0.45]) body.add(box(0.12, 1.25, 0.12, dark, sx * (w / 2 - 0.25), base + 1.5, sz * l)); // roll cage
        body.add(box(w - 0.3, 0.12, l * 0.6, dark, 0, base + 2.1, l * 0.17));
        body.add(box(w - 0.2, 0.25, 0.3, chrome, 0, base + 0.15, -l / 2 - 0.05)); // bumper
        body.add(box(0.9, 0.9, 0.3, dark, 0, base + 0.9, l / 2 + 0.1)); // spare tyre
        for (const sx of [-1, 1]) body.add(box(0.35, 0.25, 0.08, light, sx * (w / 2 - 0.5), base + 0.7, -l / 2 - 0.02));
        for (const sx of [-1, 1]) body.add(box(0.3, 0.2, 0.08, red, sx * (w / 2 - 0.4), base + 0.7, l / 2 - 0.02));
    } else if (kind === 'monster') {
        body.add(box(w - 0.6, 0.5, l - 0.4, dark, 0, base + 0.2, 0)); // chassis
        body.add(box(w - 0.4, 1.0, l * 0.95, paint, 0, base + 0.95, 0));
        body.add(box(w - 0.6, 0.9, l * 0.42, paint, 0, base + 1.9, l * 0.12)); // cab
        body.add(box(w - 0.55, 0.6, 0.08, glass, 0, base + 1.95, -l * 0.09));
        for (const sx of [-1, 1]) body.add(box(0.08, 0.55, l * 0.3, glass, sx * (w / 2 - 0.28), base + 1.95, l * 0.13));
        for (const sx of [-1, 1]) body.add(box(0.4, 0.3, 0.08, light, sx * (w / 2 - 0.6), base + 1.1, -l * 0.48));
        body.add(box(w - 0.6, 0.18, 0.12, light, 0, base + 2.42, -l * 0.08)); // roof light bar
        for (const sx of [-1, 1]) body.add(box(0.25, 0.25, 0.9, chrome, sx * 0.5, base + 0.3, l / 2 + 0.2)); // exhausts
    } else {
        body.add(box(w - 0.4, 0.5, l, paint, 0, base + 0.3, 0));
        body.add(box(w - 0.6, 0.4, l * 0.3, paint, 0, base + 0.75, -l * 0.3)); // nose
        for (const sx of [-1, 1]) body.add(box(0.12, 1.1, 0.12, chrome, sx * (w / 2 - 0.35), base + 1.1, l * 0.05));
        body.add(box(w - 0.5, 0.12, 0.12, chrome, 0, base + 1.65, l * 0.05)); // roll bar
        body.add(box(w - 0.5, 0.12, l * 0.5, chrome, 0, base + 1.65, l * 0.3));
        body.add(box(0.8, 0.5, 0.12, lambert('#ffffff'), 0, base + 0.9, l * 0.47)); // heart badge plate
        body.add(box(0.5, 0.35, 0.14, lambert('#ff2d6f', '#600020'), 0, base + 0.92, l * 0.47 + 0.02));
        for (const sx of [-1, 1]) body.add(box(0.3, 0.2, 0.08, light, sx * (w / 2 - 0.55), base + 0.55, -l / 2 - 0.02));
    }
    return { root, body, wheels };
}

export class Vehicle {
    constructor(data) {
        this.id = data.id;
        this.kind = data.kind;
        this.k = KINDS[data.kind] || KINDS.jeep;
        this.color = data.color;
        const m = buildModel(this.kind, this.color);
        this.group = m.root;
        this.body = m.body;
        this.wheels = m.wheels;
        this.pos = new THREE.Vector3(...data.pos);
        this.target = this.pos.clone();
        this.yaw = this.targetYaw = data.yaw;
        this.speed = data.speed || 0;
        this.steer = data.steer || 0;
        this.tilt = [...(data.tilt || [0, 0])];
        this.vy = 0;
        this.grounded = true;
        this.driver = data.driver;
        this.passenger = data.passenger;
        this.spin = 0;
        this.sync();
    }

    setSeats(data) {
        this.driver = data.driver;
        this.passenger = data.passenger;
    }

    /** A remote driver's update. */
    receive(m) {
        this.target.set(m.p[0], m.p[1], m.p[2]);
        this.targetYaw = m.r;
        this.speed = m.s;
        this.steer = m.st;
        this.tilt = m.t;
        if (this.pos.distanceTo(this.target) > 15) this.pos.copy(this.target);
    }

    snap(data) {
        this.pos.set(...data.pos);
        this.target.copy(this.pos);
        this.yaw = this.targetYaw = data.yaw;
        this.speed = 0;
        this.vy = 0;
    }

    interpolate(dt) {
        const t = 1 - Math.exp(-dt * 12);
        this.pos.lerp(this.target, t);
        let d = this.targetYaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * t;
    }

    forward() {
        return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }
    right() {
        return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    }

    /** Where someone sits, in world space (the hip, for the avatar). */
    seat(which) {
        const k = this.k;
        const side = which === 'passenger' ? 0.55 : -0.55;
        const back = this.kind === 'monster' ? 0.6 : this.kind === 'buggy' ? 0.3 : 0.5;
        const local = new THREE.Vector3(side * (k.w / 2 - 0.2), k.clear + k.wheel * 0.6 + (this.kind === 'monster' ? 1.6 : 1.0), back);
        local.applyEuler(new THREE.Euler(this.tilt[0], this.yaw, this.tilt[1], 'YXZ'));
        return local.add(this.pos);
    }

    sync(dt = 0) {
        this.group.position.copy(this.pos);
        this.group.rotation.y = this.yaw;
        this.body.rotation.x += (this.tilt[0] - this.body.rotation.x) * Math.min(1, dt * 10);
        this.body.rotation.z += (this.tilt[1] - this.body.rotation.z) * Math.min(1, dt * 10);
        this.spin += (this.speed * dt) / this.k.wheel;
        for (const w of this.wheels) {
            w.spin.rotation.x = -this.spin;
            if (w.front) w.pivot.rotation.y = this.steer * 0.45;
        }
    }

    dispose() {
        this.group.traverse((o) => {
            o.geometry?.dispose();
            o.material?.dispose?.();
        });
    }
}

/** The ground under one wheel: the top of the highest block within reach, or null for a wall. */
function groundAt(world, x, z, y, climb) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const top = Math.floor(y + climb);
    if (world.solid(xi, top, zi)) return null;
    for (let yy = top - 1; yy >= Math.floor(y) - 10; yy--) if (world.solid(xi, yy, zi)) return yy + 1;
    return y - 10;
}

/**
 * One physics step for the car you are driving.
 * input: { throttle -1..1, steer -1..1, boost, brake }. Returns 'bump' when it hits something hard.
 */
export function drive(v, input, world, dt, others = []) {
    const k = v.k;
    const top = input.boost ? k.boost : k.max;
    const inWater = world.get(Math.floor(v.pos.x), Math.floor(v.pos.y + 0.3), Math.floor(v.pos.z)) === WATER;
    let bump = null;

    if (v.grounded) {
        if (input.throttle > 0) v.speed += (v.speed < 0 ? k.accel * 2.5 : k.accel * (input.boost ? 1.6 : 1)) * input.throttle * dt;
        else if (input.throttle < 0) v.speed += (v.speed > 0 ? k.accel * 2.5 : k.accel * 0.7) * input.throttle * dt;
        else v.speed *= Math.exp(-0.9 * dt);
        if (input.brake) v.speed *= Math.exp(-5 * dt);
        if (inWater) v.speed *= Math.exp(-2.5 * dt);
    }
    if (v.speed > top) v.speed += (top - v.speed) * Math.min(1, dt * 3);
    if (v.speed < -k.rev) v.speed = -k.rev;

    v.steer += (input.steer - v.steer) * Math.min(1, dt * 8);
    const grip = v.grounded ? 1 : 0.3;
    v.yaw -= v.steer * k.turn * Math.max(-1, Math.min(1, v.speed / 6)) * grip * dt;

    const f = v.forward();
    const r = v.right();
    const step = (dx, dz) => {
        const nx = v.pos.x + dx, nz = v.pos.z + dz;
        const hw = k.w / 2 - 0.2, hl = k.l / 2 - 0.2;
        const pts = [
            [-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl], [0, -hl], [0, hl],
        ].map(([a, b]) => [nx + r.x * a + f.x * -b, nz + r.z * a + f.z * -b]);
        const g = pts.map(([x, z]) => groundAt(world, x, z, v.pos.y, k.climb));
        if (g.some((h) => h === null)) return null;
        // ceiling check: no driving under a low balcony with a monster truck
        if (world.solid(Math.floor(nx), Math.floor(v.pos.y + k.h), Math.floor(nz))) return null;
        return { x: nx, z: nz, g };
    };

    const move = v.forward().multiplyScalar(v.speed * dt);
    let res = step(move.x, move.z);
    if (!res && Math.abs(v.speed) > 0.5) {
        // Slide along a wall rather than stopping dead
        res = step(move.x, 0) || step(0, move.z);
        if (Math.abs(v.speed) > 6) bump = Math.abs(v.speed);
        v.speed *= res ? 0.85 : -0.35;
    }
    if (res) {
        v.pos.x = Math.max(2, Math.min(SX - 2, res.x));
        v.pos.z = Math.max(2, Math.min(SZ - 2, res.z));
        const [fl, fr, bl, br, fm, bm] = res.g;
        const ground = Math.max(...res.g);
        const front = Math.max(fl, fr, fm), back = Math.max(bl, br, bm);
        const left = Math.max(fl, bl), right = Math.max(fr, br);
        const pitch = Math.atan2(front - back, k.l * 0.8);
        const roll = Math.atan2(right - left, k.w * 0.8);
        if (v.grounded || v.pos.y <= ground) {
            if (ground > v.pos.y) {
                // climbing: remember how fast we went up so a ramp's lip launches us
                v.vy = Math.min((ground - v.pos.y) / dt, 13);
                v.pos.y = ground;
                v.grounded = true;
            } else if (ground < v.pos.y - 0.05) {
                v.grounded = false;
            } else {
                v.pos.y = ground;
                // Keep a little of the climb's lift for a moment, so the lip of a ramp still launches us.
                v.vy = Math.max(0, v.vy - GRAVITY * 1.5 * dt);
                v.grounded = true;
            }
        }
        if (!v.grounded) {
            v.vy -= GRAVITY * dt;
            v.pos.y += v.vy * dt;
            if (v.pos.y <= ground) {
                if (v.vy < -14) bump = -v.vy;
                v.pos.y = ground;
                v.vy = v.vy < -12 ? -v.vy * 0.2 : 0;
                v.grounded = v.vy === 0;
            }
        }
        v.tilt = v.grounded ? [pitch, roll] : [Math.max(-0.5, Math.min(0.5, -v.vy * 0.03)), v.tilt[1] * 0.95];
    }

    // Cars shove each other apart
    for (const o of others) {
        const dx = v.pos.x - o.pos.x, dz = v.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        const min = (Math.max(k.w, k.l) + Math.max(o.k.w, o.k.l)) * 0.38;
        if (d > 0.01 && d < min && Math.abs(v.pos.y - o.pos.y) < 3) {
            const push = (min - d) / d;
            const tryX = v.pos.x + dx * push, tryZ = v.pos.z + dz * push;
            if (step(tryX - v.pos.x, tryZ - v.pos.z)) {
                v.pos.x = tryX;
                v.pos.z = tryZ;
            }
            if (Math.abs(v.speed) > 6) bump = Math.max(bump || 0, Math.abs(v.speed));
            v.speed *= -0.4;
        }
    }

    if (v.pos.y < -20) {
        v.pos.y = 40;
        v.vy = 0;
    }
    return bump;
}
