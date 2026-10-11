import * as THREE from 'three';
import { VoxelWorld } from './voxels';
import { Avatar, emojiSprite } from './avatar';
import { Vehicle, drive, KINDS } from './vehicles';
import { getAtlas } from './textures';
import { BLOCKS, AIR, WATER, DEFAULT_HOTBAR } from '@shared/blocks.js';
import { SPAWN, zoneAt, inBounds, SX, SY, SZ } from '@shared/world.js';
import { sfx } from '@/lib/sfx';
import GAME_MODULES from '@/games';

/**
 * Dream Craft's game engine: owns the three.js scene, your player (physics,
 * camera, building), everyone else's avatars and whichever mini-game is
 * running. React drives it through methods and listens through `ui(type, data)`;
 * the network goes out through `net.send(event, data)`.
 */

const EYE = 1.62;
const HALF = 0.3;
const HEIGHT = 1.8;
const GRAVITY = 30;
const JUMP = 9.4;
const WALK = 4.6;
const SPRINT = 7.4;
const FLY = 12;
const REACH = 6;
const SEND_EVERY = 1 / 15;
const DAY_SKY = new THREE.Color('#9fd8ff');
const NIGHT_SKY = new THREE.Color('#0d1233');
const EMOTE_EMOJI = { hearts: '💖', wave: '👋', kiss: '😘', laugh: '😂', dance: '💃' };

/** A box textured with one block's tiles, for the held block and particles. */
export function blockGeometry(id, size = 1) {
    const g = new THREE.BoxGeometry(size, size, size);
    const { tileOf, uv } = getAtlas();
    const [top, side, bottom] = tileOf[id];
    const a = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = uv(f === 2 ? top : f === 3 ? bottom : side);
        for (let k = 0; k < 4; k++) {
            const i = f * 4 + k;
            a.setXY(i, u0 + a.getX(i) * (u1 - u0), v0 + a.getY(i) * (v1 - v0));
        }
    }
    return g;
}

export class Engine {
    constructor(container, { me, profile, net, ui }) {
        this.container = container;
        this.meId = me;
        this.profile = profile;
        this.net = net;
        this.ui = ui;

        const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        container.appendChild(renderer.domElement);
        this.renderer = renderer;

        this.scene = new THREE.Scene();
        this.scene.background = DAY_SKY.clone();
        this.scene.fog = new THREE.Fog(DAY_SKY.clone(), 70, 210);
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
        this.scene.add(this.camera);

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x8fae7a, 1.6);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
        this.sun.position.set(0.5, 1, 0.3);
        this.scene.add(this.hemi, this.sun);

        this.world = new VoxelWorld();
        this.scene.add(this.world.group);

        // You
        this.pos = new THREE.Vector3(...SPAWN.pos);
        this.vel = new THREE.Vector3();
        this.push = new THREE.Vector3();
        this.yaw = SPAWN.yaw;
        this.pitch = 0;
        this.onGround = false;
        this.inWater = false;
        this.flying = false;
        this.stepSmooth = 0;
        this.view = 0; // 0 first person, 1 behind, 2 in front
        this.hotbar = this.loadHotbar();
        this.slot = 0;
        this.night = false;
        this.myAvatar = new Avatar(profile);
        this.myAvatar.setName(profile.name);
        this.myAvatar.tag.visible = false;
        this.scene.add(this.myAvatar.group);

        this.remotes = new Map();
        this.vehicles = new Map();
        this.riding = null; // { id, seat: 'driver' | 'passenger' }
        this.camOffset = 0;
        this.knockCooldown = 0;
        this.vehicleSend = 0;
        this.particles = [];
        this.floaters = [];
        this.namesVisible = true;
        this.frozenUntil = 0;
        this.serverOffset = 0;
        this.game = null;

        this.keys = new Set();
        this.inputEnabled = true;
        this.locked = false;
        this.touch = { x: 0, y: 0, jump: false, down: false };
        this.repeat = null;
        this.sendTimer = 0;
        this.hudTimer = 0;
        this.lastSent = '';

        this.buildScenery();
        this.buildHand();
        this.highlight = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
            new THREE.LineBasicMaterial({ color: 0x1b1b20, transparent: true, opacity: 0.6 })
        );
        this.highlight.visible = false;
        this.scene.add(this.highlight);

        this.bindInput();
        this.resize();
        this.ro = new ResizeObserver(() => this.resize());
        this.ro.observe(container);
        this.clock = new THREE.Clock();
    }

    /* ── Setup ─────────────────────────────────────────────────────── */

    load(edits) {
        for (let k = 0; k + 1 < edits.length; k += 2) this.world.setIndex(edits[k], edits[k + 1]);
        this.world.buildAll();
    }

    start() {
        const loop = () => {
            this.raf = requestAnimationFrame(loop);
            const dt = Math.min(this.clock.getDelta(), 0.05);
            this.update(dt);
            this.renderer.render(this.scene, this.camera);
        };
        loop();
        this.emitHotbar();
    }

    resize() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    buildScenery() {
        // Soft blocky clouds drifting overhead
        this.clouds = new THREE.Group();
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
        for (let i = 0; i < 26; i++) {
            const w = 8 + Math.random() * 18, d = 6 + Math.random() * 12;
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), cloudMat);
            m.position.set(Math.random() * SX * 1.6 - SX * 0.3, 70 + Math.random() * 6, Math.random() * SZ * 1.6 - SZ * 0.3);
            this.clouds.add(m);
        }
        this.scene.add(this.clouds);

        // A square sun and moon, block-game style
        this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false }));
        this.scene.add(this.sunMesh);

        const starGeo = new THREE.BufferGeometry();
        const pts = [];
        for (let i = 0; i < 900; i++) {
            const v = new THREE.Vector3().randomDirection();
            if (v.y < 0.05) v.y = -v.y + 0.05;
            pts.push(v.x * 300, v.y * 300, v.z * 300);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
        this.stars.visible = false;
        this.scene.add(this.stars);
    }

    buildHand() {
        this.hand = new THREE.Group();
        this.hand.position.set(0.36, -0.3, -0.55);
        this.camera.add(this.hand);
        this.setHandBlock(this.hotbar[this.slot]);
    }

    setHandBlock(id) {
        if (this.handMesh) {
            this.hand.remove(this.handMesh);
            this.handMesh.geometry.dispose();
        }
        if (!this.handMat) this.handMat = new THREE.MeshBasicMaterial({ map: getAtlas().texture, transparent: true, alphaTest: 0.1 });
        this.handMesh = new THREE.Mesh(blockGeometry(id, 0.16), this.handMat);
        this.handMesh.rotation.set(0.1, -0.7, 0.05);
        this.hand.add(this.handMesh);
    }

    loadHotbar() {
        try {
            const saved = JSON.parse(localStorage.getItem('dc-hotbar'));
            if (Array.isArray(saved) && saved.length === 9 && saved.every((id) => BLOCKS[id]?.placeable)) return saved;
        } catch { /* fresh hotbar */ }
        return [...DEFAULT_HOTBAR];
    }

    /* ── Input ─────────────────────────────────────────────────────── */

    bindInput() {
        const el = this.renderer.domElement;
        const typing = (e) => /input|textarea|select/i.test(e.target?.tagName || '');

        this.onKeyDown = (e) => {
            if (typing(e) || !this.inputEnabled) return;
            this.keys.add(e.code);
            if (e.code.startsWith('Digit')) {
                const n = Number(e.code.slice(5));
                if (n >= 1 && n <= 9) this.selectSlot(n - 1);
            }
            if (e.code === 'KeyF' && !this.riding) this.toggleFly();
            if (e.code === 'KeyR' && this.riding?.seat === 'driver') this.net.send('vehicle:reset', { id: this.riding.id });
            if (e.code === 'KeyV' || e.code === 'F5') {
                e.preventDefault();
                this.cycleView();
            }
            if (e.code === 'Space') e.preventDefault();
        };
        this.onKeyUp = (e) => this.keys.delete(e.code);
        this.onBlur = () => {
            this.keys.clear();
            this.stopRepeat();
        };
        this.onMouseMove = (e) => {
            if (!this.locked) return;
            this.look(e.movementX, e.movementY);
        };
        this.onMouseDown = (e) => {
            if (!this.locked || !this.inputEnabled) return;
            if (e.button === 0) this.startRepeat(() => this.primary());
            else if (e.button === 2) this.startRepeat(() => this.secondary());
            else if (e.button === 1) this.pickBlock();
        };
        this.onMouseUp = () => this.stopRepeat();
        this.onWheel = (e) => {
            if (!this.locked) return;
            this.selectSlot((this.slot + (e.deltaY > 0 ? 1 : 8)) % 9);
        };
        this.onClick = () => {
            if (this.inputEnabled && !this.locked && !this.isTouch) this.requestLock();
        };
        this.onLockChange = () => {
            this.locked = document.pointerLockElement === el;
            if (!this.locked) this.stopRepeat();
            this.ui('lock', this.locked);
        };
        this.onContext = (e) => e.preventDefault();

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('pointerlockchange', this.onLockChange);
        el.addEventListener('mousedown', this.onMouseDown);
        el.addEventListener('wheel', this.onWheel, { passive: true });
        el.addEventListener('click', this.onClick);
        el.addEventListener('contextmenu', this.onContext);
    }

    requestLock() {
        const el = this.renderer.domElement;
        try {
            const p = el.requestPointerLock?.({ unadjustedMovement: true });
            p?.catch?.(() => el.requestPointerLock?.());
        } catch {
            el.requestPointerLock?.();
        }
        sfx.unlock();
    }

    releaseLock() {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    setInputEnabled(on) {
        this.inputEnabled = on;
        if (!on) {
            this.keys.clear();
            this.stopRepeat();
            this.releaseLock();
        }
    }

    look(dx, dy, sens = 0.0024) {
        if (this.riding) {
            this.camOffset -= dx * sens;
            this.camIdle = 0;
            this.pitch = Math.max(-0.9, Math.min(0.6, this.pitch - dy * sens));
            return;
        }
        this.yaw -= dx * sens;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * sens));
    }

    startRepeat(fn) {
        this.stopRepeat();
        fn();
        this.repeat = setInterval(fn, 230);
    }
    stopRepeat() {
        clearInterval(this.repeat);
        this.repeat = null;
    }

    selectSlot(i) {
        this.slot = i;
        this.setHandBlock(this.hotbar[i]);
        this.emitHotbar();
    }

    setHotbarBlock(slot, id) {
        this.hotbar[slot] = id;
        try { localStorage.setItem('dc-hotbar', JSON.stringify(this.hotbar)); } catch { /* ignore */ }
        if (slot === this.slot) this.setHandBlock(id);
        this.emitHotbar();
    }

    emitHotbar() {
        this.ui('hotbar', { hotbar: [...this.hotbar], slot: this.slot });
    }

    get held() {
        return this.hotbar[this.slot];
    }

    canFly() {
        return !this.game || this.game.mod?.allowFly === true || this.game.view.phase === 'over';
    }

    toggleFly() {
        if (!this.canFly()) {
            this.ui('toast', { text: 'No flying during this game 😉' });
            return;
        }
        this.flying = !this.flying;
        this.vel.set(0, 0, 0);
        this.ui('toast', { text: this.flying ? 'Flying ✨ (Space up, Shift down)' : 'Walking 🚶' });
    }

    cycleView() {
        this.view = (this.view + 1) % 3;
    }

    setNight(night) {
        this.night = night;
        this.world.setNight(night);
        const sky = night ? NIGHT_SKY : DAY_SKY;
        this.scene.background.copy(sky);
        this.scene.fog.color.copy(sky);
        this.hemi.intensity = night ? 0.35 : 1.6;
        this.sun.intensity = night ? 0.25 : 1.6;
        this.sunMesh.material.color.set(night ? 0xe8eefc : 0xfff3a0);
        this.stars.visible = night;
        this.clouds.children.forEach((c) => (c.material.opacity = night ? 0.25 : 0.85));
    }

    /* ── Touch controls ────────────────────────────────────────────── */

    setTouch(state) {
        Object.assign(this.touch, state);
    }

    /* ── Building ──────────────────────────────────────────────────── */

    eye() {
        return new THREE.Vector3(this.pos.x, this.pos.y + EYE + this.stepSmooth, this.pos.z);
    }
    lookDir() {
        return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    }
    aim(range = REACH) {
        return this.world.raycast(this.eye(), this.lookDir(), range);
    }

    buildLocked() {
        return !!(this.game && this.game.view.phase !== 'over' && this.game.mod?.noBuild);
    }

    primary() {
        if (this.riding) return;
        if (this.game?.mod?.primary?.(this, this.game.view)) return;
        if (this.buildLocked()) return;
        const hit = this.aim();
        if (!hit || hit.y === 0) return;
        this.world.set(hit.x, hit.y, hit.z, AIR);
        this.net.send('world:set', { x: hit.x, y: hit.y, z: hit.z, id: AIR });
        this.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, hit.id);
        sfx.break();
        this.swingHand();
    }

    secondary() {
        if (this.riding) return;
        if (this.game?.mod?.secondary?.(this, this.game.view)) return;
        if (this.buildLocked()) return;
        const hit = this.aim();
        if (!hit) return;
        const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
        if (!inBounds(x, y, z) || this.world.solid(x, y, z)) return;
        if (this.bodyOverlaps(this.pos, x, y, z)) return;
        for (const r of this.remotes.values()) if (this.bodyOverlaps(r.pos, x, y, z)) return;
        for (const v of this.vehicles.values()) if (Math.hypot(v.pos.x - x - 0.5, v.pos.z - z - 0.5) < Math.max(v.k.w, v.k.l) / 2 && y >= Math.floor(v.pos.y) - 1 && y < v.pos.y + v.k.h) return;
        const id = this.held;
        this.world.set(x, y, z, id);
        this.net.send('world:set', { x, y, z, id });
        sfx.place();
        this.swingHand();
    }

    pickBlock() {
        const hit = this.aim();
        if (hit && BLOCKS[hit.id].placeable) this.setHotbarBlock(this.slot, hit.id);
    }

    bodyOverlaps(p, x, y, z) {
        return p.x + HALF > x && p.x - HALF < x + 1 && p.y + HEIGHT > y && p.y < y + 1 && p.z + HALF > z && p.z - HALF < z + 1;
    }

    swingHand() {
        this.handSwing = 1;
    }

    /** Someone else's block change (or the server correcting ours). */
    applyEdit(i, id) {
        this.world.setIndex(i, id);
    }
    applyBulk(list) {
        for (let k = 0; k + 1 < list.length; k += 2) this.world.setIndex(list[k], list[k + 1]);
    }

    /* ── Physics ───────────────────────────────────────────────────── */

    collides(p) {
        const x0 = Math.floor(p.x - HALF), x1 = Math.floor(p.x + HALF - 1e-6);
        const y0 = Math.floor(p.y), y1 = Math.floor(p.y + HEIGHT - 1e-6);
        const z0 = Math.floor(p.z - HALF), z1 = Math.floor(p.z + HALF - 1e-6);
        for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.world.solid(x, y, z)) return true;
        return false;
    }

    moveAxis(axis, d, canStep) {
        if (!d) return false;
        const p = this.pos;
        const before = p[axis];
        p[axis] += d;
        if (!this.collides(p)) return false;
        if (axis !== 'y' && canStep) {
            // Auto-step: walk up one block without jumping, like stairs.
            const oldY = p.y;
            p.y = Math.floor(p.y + 0.01) + 1;
            if (p.y - oldY <= 1.05 && !this.collides(p)) {
                this.stepSmooth -= p.y - oldY;
                return false;
            }
            p.y = oldY;
        }
        if (axis === 'y') {
            if (d < 0) p.y = Math.floor(p.y) + 1;
            else p.y = Math.floor(p.y + HEIGHT) - HEIGHT - 1e-4;
        } else if (d > 0) p[axis] = Math.floor(p[axis] + HALF) - HALF - 1e-4;
        else p[axis] = Math.floor(p[axis] - HALF) + 1 + HALF + 1e-4;
        if (this.collides(p)) p[axis] = before;
        return true;
    }

    teleport(pos, yaw) {
        if (this.riding) this.leaveVehicle(false);
        this.pos.set(pos[0], pos[1], pos[2]);
        this.vel.set(0, 0, 0);
        this.push.set(0, 0, 0);
        if (typeof yaw === 'number') this.yaw = yaw;
        this.pitch = 0;
        this.stepSmooth = 0;
        if (!this.canFly()) this.flying = false;
        this.sendMove(true);
    }

    knock(dir, power = 7) {
        this.push.set(dir.x, 0, dir.z).normalize().multiplyScalar(power);
        this.vel.y = Math.max(this.vel.y, 5);
    }

    serverNow() {
        return Date.now() + this.serverOffset;
    }

    updatePlayer(dt) {
        const k = this.keys;
        const frozen = this.serverNow() < this.frozenUntil;
        let f = 0, r = 0;
        if (this.inputEnabled && !frozen) {
            f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.touch.y;
            r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.touch.x;
        }
        const up = !frozen && this.inputEnabled && (k.has('Space') || this.touch.jump);
        const down = !frozen && this.inputEnabled && (k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.down);
        const sprint = !this.flying && (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('ControlLeft') || this.touch.sprint);
        if (!this.canFly()) this.flying = false;

        const len = Math.hypot(f, r);
        if (len > 1) { f /= len; r /= len; }
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        const feet = this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
        this.inWater = feet === WATER;

        let speed = this.flying ? FLY : sprint ? SPRINT : WALK;
        if (this.inWater && !this.flying) speed *= 0.55;
        const wantX = (fx * f + rx * r) * speed;
        const wantZ = (fz * f + rz * r) * speed;
        const accel = this.onGround || this.flying || this.inWater ? 18 : 6;
        const blend = 1 - Math.exp(-accel * dt);
        this.vel.x += (wantX - this.vel.x) * blend;
        this.vel.z += (wantZ - this.vel.z) * blend;

        if (this.flying) {
            this.vel.y = (up ? FLY * 0.8 : 0) - (down ? FLY * 0.8 : 0);
        } else if (this.inWater) {
            this.vel.y = Math.max(this.vel.y - GRAVITY * 0.3 * dt, -3.5);
            if (up) this.vel.y = 4.2;
        } else {
            this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -45);
            if (up && this.onGround) {
                this.vel.y = JUMP;
                this.onGround = false;
                sfx.jump();
            }
        }

        // knockback from snowballs fades out quickly
        const pushDecay = Math.exp(-5 * dt);
        this.push.multiplyScalar(pushDecay);

        const total = new THREE.Vector3(this.vel.x + this.push.x, this.vel.y, this.vel.z + this.push.z).multiplyScalar(dt);
        const steps = Math.max(1, Math.ceil(total.length() / 0.35));
        const wasGround = this.onGround;
        this.onGround = false;
        for (let s = 0; s < steps; s++) {
            const canStep = (wasGround || this.inWater) && !this.flying;
            if (this.moveAxis('x', total.x / steps, canStep)) { this.vel.x = 0; this.push.x = 0; }
            if (this.moveAxis('z', total.z / steps, canStep)) { this.vel.z = 0; this.push.z = 0; }
            if (this.moveAxis('y', total.y / steps, false)) {
                if (total.y < 0) this.onGround = true;
                this.vel.y = 0;
            }
        }
        if (!this.onGround && !this.flying && this.vel.y <= 0) {
            // Standing still on the ground still counts as standing.
            const probe = this.pos.clone();
            probe.y -= 0.02;
            if (this.collides(probe)) this.onGround = true;
        }

        // Pushed into a wall (a block placed on you, a bad teleport): pop up.
        let guard = 0;
        while (this.collides(this.pos) && guard++ < SY) this.pos.y = Math.floor(this.pos.y) + 1;

        this.pos.x = Math.max(0.5, Math.min(SX - 0.5, this.pos.x));
        this.pos.z = Math.max(0.5, Math.min(SZ - 0.5, this.pos.z));
        if (this.pos.y < -20) {
            this.teleport(SPAWN.pos, SPAWN.yaw);
            this.ui('toast', { text: 'Whoops! Back to the front gate 🏡' });
        }
        this.stepSmooth *= Math.exp(-14 * dt);
        this.moving = Math.hypot(this.vel.x, this.vel.z) > 0.5;
    }

    updateCamera(dt) {
        const eye = this.eye();
        const dir = this.lookDir();
        const car = this.riding && this.vehicles.get(this.riding.id);
        this.myAvatar.group.visible = this.view !== 0 || !!car;
        this.hand.visible = this.view === 0 && !car;
        if (car) {
            // Chase camera; mouse orbits it and it drifts back behind the car
            this.camIdle = (this.camIdle || 0) + dt;
            if (this.camIdle > 1.2) this.camOffset *= Math.exp(-2 * dt);
            const yaw = car.yaw + this.camOffset;
            const dist = car.k.l + 4.5;
            const back = new THREE.Vector3(Math.sin(yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(yaw) * Math.cos(this.pitch));
            const target = car.pos.clone().add(new THREE.Vector3(0, car.k.h * 0.8, 0));
            const hit = this.world.raycast(target, back, dist);
            const d = hit ? Math.max(1, hit.dist - 0.3) : dist;
            const want = target.clone().addScaledVector(back, d);
            this.camera.position.lerp(want, 1 - Math.exp(-dt * 10));
            if (this.shake > 0) {
                this.camera.position.x += (Math.random() - 0.5) * this.shake;
                this.camera.position.y += (Math.random() - 0.5) * this.shake;
                this.shake = Math.max(0, this.shake - dt * 2);
            }
            this.camera.lookAt(target);
        } else if (this.view === 0) {
            this.camera.position.copy(eye);
            this.camera.lookAt(eye.clone().add(dir));
        } else {
            const back = this.view === 1 ? dir.clone().negate() : dir.clone();
            const hit = this.world.raycast(eye, back, 4.5);
            const d = hit ? Math.max(0.3, hit.dist - 0.25) : 4.5;
            this.camera.position.copy(eye).addScaledVector(back, d);
            this.camera.lookAt(eye);
        }
        if (!car) {
            this.myAvatar.group.position.copy(this.pos);
            this.myAvatar.group.rotation.y = this.yaw;
        }
        this.myAvatar.sitting = !!car;
        this.myAvatar.animate(dt, car ? 0 : Math.hypot(this.vel.x, this.vel.z), car ? 0 : this.pitch);

        // Hand bob and swing
        const bob = this.moving && this.onGround ? Math.sin(performance.now() / 110) * 0.02 : 0;
        this.handSwing = Math.max(0, (this.handSwing || 0) - dt * 6);
        this.hand.position.set(0.36, -0.3 + bob - this.handSwing * 0.08, -0.55 + this.handSwing * 0.1);
        this.hand.rotation.x = -this.handSwing * 0.8;

        // The sun follows you so it is always over the horizon
        this.sunMesh.position.set(this.pos.x + 90, 160, this.pos.z - 120);
        this.sunMesh.lookAt(this.pos.x, this.pos.y, this.pos.z);
        this.stars.position.copy(this.camera.position);
        for (const c of this.clouds.children) {
            c.position.x += dt * 1.5;
            if (c.position.x > SX * 1.3) c.position.x = -SX * 0.3;
        }
    }

    sendMove(force = false) {
        const p = this.pos;
        const msg = {
            p: [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100],
            r: Math.round(this.yaw * 100) / 100,
            m: this.moving,
            f: this.flying,
            h: this.held,
        };
        const key = JSON.stringify(msg);
        if (!force && key === this.lastSent) return;
        this.lastSent = key;
        this.net.send('player:move', msg);
    }

    /* ── Other players ─────────────────────────────────────────────── */

    addPlayer(p) {
        if (p.id === this.meId) return;
        this.removePlayer(p.id);
        const avatar = new Avatar(p);
        avatar.setName(p.name);
        const pos = new THREE.Vector3(...(p.pos || SPAWN.pos));
        avatar.group.position.copy(pos);
        this.scene.add(avatar.group);
        this.remotes.set(p.id, { id: p.id, data: p, avatar, pos, target: pos.clone(), yaw: p.yaw || 0, targetYaw: p.yaw || 0, speed: 0 });
    }

    updatePlayerLook(p) {
        if (p.id === this.meId) {
            this.myAvatar.build(p);
            return;
        }
        const r = this.remotes.get(p.id);
        if (!r) return this.addPlayer(p);
        r.data = p;
        r.avatar.build(p);
        r.avatar.setName(p.name);
    }

    movePlayer(m) {
        const r = this.remotes.get(m.id);
        if (!r) return;
        r.target.set(m.p[0], m.p[1], m.p[2]);
        r.targetYaw = m.r;
        r.moving = m.m;
        // A big jump means a teleport: snap instead of sliding across the map.
        if (r.pos.distanceTo(r.target) > 12) r.pos.copy(r.target);
    }

    removePlayer(id) {
        const r = this.remotes.get(id);
        if (!r) return;
        this.scene.remove(r.avatar.group);
        r.avatar.dispose();
        this.remotes.delete(id);
    }

    playerPos(id) {
        if (id === this.meId) return this.pos;
        return this.remotes.get(id)?.pos || null;
    }

    updateRemotes(dt) {
        const t = 1 - Math.exp(-dt * 14);
        for (const r of this.remotes.values()) {
            const before = r.pos.clone();
            r.pos.lerp(r.target, t);
            let dy = r.targetYaw - r.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            r.yaw += dy * t;
            const sp = Math.hypot(r.pos.x - before.x, r.pos.z - before.z) / Math.max(dt, 1e-4);
            r.speed += (sp - r.speed) * 0.3;
            r.avatar.group.position.copy(r.pos);
            r.avatar.group.rotation.y = r.yaw;
            r.avatar.animate(dt, r.speed);
            // updateVehicles() sets these again for anyone still in a seat
            r.avatar.sitting = false;
            r.inVehicle = false;
            if (r.avatar.tag) r.avatar.tag.visible = this.namesVisible;
        }
    }

    /** The other player under the crosshair, within range and not behind a wall. */
    pickPlayer(range = 5) {
        const ray = new THREE.Ray(this.eye(), this.lookDir());
        const wall = this.aim(range);
        let best = null, bestD = wall ? wall.dist : range;
        const hitPt = new THREE.Vector3();
        for (const r of this.remotes.values()) {
            const box = new THREE.Box3(new THREE.Vector3(r.pos.x - 0.45, r.pos.y, r.pos.z - 0.45), new THREE.Vector3(r.pos.x + 0.45, r.pos.y + 1.95, r.pos.z + 0.45));
            if (ray.intersectBox(box, hitPt)) {
                const d = hitPt.distanceTo(ray.origin);
                if (d < bestD) { bestD = d; best = r.id; }
            }
        }
        return best;
    }

    setBadge(id, emoji) {
        const a = id === this.meId ? this.myAvatar : this.remotes.get(id)?.avatar;
        a?.setBadge(emoji);
    }
    clearBadges() {
        this.myAvatar.setBadge(null);
        for (const r of this.remotes.values()) r.avatar.setBadge(null);
    }

    /* ── Vehicles ──────────────────────────────────────────────────── */

    loadVehicles(list = []) {
        for (const v of this.vehicles.values()) {
            this.scene.remove(v.group);
            v.dispose();
        }
        this.vehicles.clear();
        for (const data of list) {
            const v = new Vehicle(data);
            this.vehicles.set(v.id, v);
            this.scene.add(v.group);
        }
        this.riding = null;
    }

    /** Seats changed (or the car was reset) — from the server. */
    vehicleUpdate(data) {
        const v = this.vehicles.get(data.id);
        if (!v) return;
        v.setSeats(data);
        const iDrive = data.driver === this.meId && this.riding?.id === v.id;
        if (data.reset || !iDrive) v.snap(data);
        if (this.riding?.id === v.id) {
            if (data.driver === this.meId) this.riding.seat = 'driver';
            else if (data.passenger === this.meId) this.riding.seat = 'passenger';
            else this.leaveVehicle(false);
        }
    }

    vehicleMoved(m) {
        const v = this.vehicles.get(m.id);
        if (v && !(this.riding?.id === v.id && this.riding.seat === 'driver')) v.receive(m);
    }

    nearestVehicle(range = 4.5) {
        let best = null, bestD = range;
        for (const v of this.vehicles.values()) {
            const d = Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z) - Math.max(v.k.w, v.k.l) / 2;
            if (d < bestD && Math.abs(v.pos.y - this.pos.y) < 4 && (!v.driver || !v.passenger)) {
                bestD = d;
                best = v;
            }
        }
        return best;
    }

    async toggleVehicle() {
        if (this.riding) return this.leaveVehicle(true);
        const v = this.nearestVehicle();
        if (!v) return;
        const res = await this.net.request('vehicle:enter', { id: v.id });
        if (!res.ok) return this.ui('toast', { text: res.message });
        this.riding = { id: v.id, seat: res.seat };
        this.flying = false;
        this.camOffset = 0;
        this.pitch = -0.25;
        this.vel.set(0, 0, 0);
        if (res.seat === 'driver') {
            v.target.copy(v.pos);
            v.speed = 0;
            v.vy = 0;
            v.grounded = true;
        }
        sfx.go();
        this.ui('toast', { text: res.seat === 'driver' ? `${KINDS[v.kind].name}! W/S drive · A/D steer · Shift nitro · Space brake · E get out` : 'Riding along 💕 Press E to hop out' });
    }

    leaveVehicle(tell = true) {
        const r = this.riding;
        if (!r) return;
        this.riding = null;
        if (tell) this.net.send('vehicle:exit');
        const v = this.vehicles.get(r.id);
        this.myAvatar.sitting = false;
        if (!v) return;
        // Step out beside the car, whichever side is free
        const side = v.right().multiplyScalar(v.k.w / 2 + 0.8);
        const back = v.forward().multiplyScalar(-(v.k.l / 2 + 0.8));
        for (const off of [side.clone().negate(), side, back]) {
            const p = v.pos.clone().add(off);
            p.y = v.pos.y + 0.05;
            if (!this.collides(p)) {
                this.pos.copy(p);
                break;
            }
            this.pos.copy(p);
        }
        this.vel.set(0, 0, 0);
        this.yaw = v.yaw;
        this.pitch = 0;
        this.sendMove(true);
    }

    updateDriving(dt) {
        const v = this.vehicles.get(this.riding.id);
        if (!v) return (this.riding = null);
        if (this.riding.seat === 'driver') {
            const k = this.keys;
            const on = this.inputEnabled;
            const input = {
                throttle: on ? (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.touch.y : 0,
                steer: on ? (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.touch.x : 0,
                boost: on && (k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.sprint),
                brake: on && (k.has('Space') || this.touch.jump),
            };
            input.throttle = Math.max(-1, Math.min(1, input.throttle));
            input.steer = Math.max(-1, Math.min(1, input.steer));
            const others = [...this.vehicles.values()].filter((o) => o !== v);
            const bump = drive(v, input, this.world, dt, others);
            if (bump) {
                sfx.hit();
                this.shake = Math.min(0.6, bump / 40);
            }
            this.vehicleSend += dt;
            if (this.vehicleSend >= SEND_EVERY) {
                this.vehicleSend = 0;
                const r2 = (n) => Math.round(n * 100) / 100;
                this.net.send('vehicle:move', { id: v.id, p: [r2(v.pos.x), r2(v.pos.y), r2(v.pos.z)], r: r2(v.yaw), s: r2(v.speed), st: r2(v.steer), t: v.tilt.map(r2) });
            }
        }
        const seat = v.seat(this.riding.seat);
        this.pos.set(seat.x, seat.y - 0.7, seat.z);
        this.vel.set(0, 0, 0);
        this.moving = Math.abs(v.speed) > 0.5;
        this.onGround = true;
        this.inWater = false;
    }

    /** People never stand inside each other, and a moving car sends you flying. */
    repel(dt) {
        this.knockCooldown = Math.max(0, this.knockCooldown - dt);
        for (const r of this.remotes.values()) {
            if (r.inVehicle) continue;
            const dx = this.pos.x - r.pos.x, dz = this.pos.z - r.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.65 && Math.abs(this.pos.y - r.pos.y) < 1.7) {
                const push = (0.65 - d) * 0.5 + 0.001;
                const nx = d > 1e-3 ? dx / d : Math.random() - 0.5, nz = d > 1e-3 ? dz / d : Math.random() - 0.5;
                this.moveAxis('x', nx * push, false);
                this.moveAxis('z', nz * push, false);
            }
        }
        for (const v of this.vehicles.values()) {
            const rel = this.pos.clone().sub(v.pos);
            if (rel.y < -1.5 || rel.y > v.k.h) continue;
            const f = v.forward(), r = v.right();
            const lx = rel.x * r.x + rel.z * r.z;
            const lf = rel.x * f.x + rel.z * f.z;
            const hx = v.k.w / 2 + HALF, hf = v.k.l / 2 + HALF;
            if (Math.abs(lx) >= hx || Math.abs(lf) >= hf) continue;
            const penX = hx - Math.abs(lx), penF = hf - Math.abs(lf);
            const out = penX < penF ? r.multiplyScalar(Math.sign(lx) || 1).multiplyScalar(penX) : f.clone().multiplyScalar((Math.sign(lf) || 1) * penF);
            this.moveAxis('x', out.x, false);
            this.moveAxis('z', out.z, false);
            if (Math.abs(v.speed) > 5 && this.knockCooldown === 0) {
                this.knockCooldown = 0.8;
                const fling = v.forward().multiplyScalar(Math.sign(v.speed)).add(out.clone().normalize());
                this.knock(fling, Math.min(20, Math.abs(v.speed) * 0.9));
                this.vel.y = 7 + Math.abs(v.speed) * 0.15;
                sfx.hit();
                this.ui('flash', 'hit');
                this.ui('toast', { text: 'Beep beep! 🚙💨' });
            }
        }
    }

    updateVehicles(dt) {
        for (const v of this.vehicles.values()) {
            const mine = this.riding?.id === v.id && this.riding.seat === 'driver';
            if (!mine) {
                if (v.driver) v.interpolate(dt);
                else v.speed *= Math.exp(-3 * dt);
            }
            v.sync(dt);
            for (const [who, seat] of [[v.driver, 'driver'], [v.passenger, 'passenger']]) {
                if (!who) continue;
                const a = who === this.meId ? this.myAvatar : this.remotes.get(who)?.avatar;
                if (!a) continue;
                const s = v.seat(seat);
                a.group.position.set(s.x, s.y - 0.7, s.z);
                a.group.rotation.y = v.yaw;
                a.sitting = true;
                const r = this.remotes.get(who);
                if (r) {
                    r.inVehicle = true;
                    r.pos.copy(a.group.position);
                    r.target.copy(a.group.position);
                }
            }
        }
    }

    /* ── Effects ───────────────────────────────────────────────────── */

    burst(x, y, z, id, n = 10) {
        if (!this.particleMat) this.particleMat = new THREE.MeshBasicMaterial({ map: getAtlas().texture, transparent: true, alphaTest: 0.1 });
        const geo = blockGeometry(id, 0.14);
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(geo, this.particleMat);
            m.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
            this.scene.add(m);
            this.particles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4), life: 0.6 + Math.random() * 0.3, shared: geo });
        }
    }

    /** Emoji that float up from someone's head: hearts, kisses, waves. */
    emote(id, kind) {
        const p = this.playerPos(id);
        if (!p) return;
        const a = id === this.meId ? this.myAvatar : this.remotes.get(id)?.avatar;
        a?.play(kind);
        const emoji = EMOTE_EMOJI[kind] || '💖';
        const count = kind === 'hearts' ? 7 : 3;
        for (let i = 0; i < count; i++) {
            const s = emojiSprite(i % 3 === 2 && kind === 'hearts' ? '💕' : emoji, 0.5);
            s.position.set(p.x + (Math.random() - 0.5) * 0.8, p.y + 2 + Math.random() * 0.4, p.z + (Math.random() - 0.5) * 0.8);
            this.scene.add(s);
            this.floaters.push({ s, life: 1.6 + i * 0.12, delay: i * 0.12 });
        }
        if (kind === 'hearts' || kind === 'kiss') sfx.heart();
        else sfx.pop();
    }

    floatEmoji(emoji, pos, size = 0.7) {
        const s = emojiSprite(emoji, size);
        s.position.copy(pos);
        this.scene.add(s);
        this.floaters.push({ s, life: 1.4, delay: 0 });
    }

    updateEffects(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.v.y -= 18 * dt;
            p.m.position.addScaledVector(p.v, dt);
            if (p.life <= 0) {
                this.scene.remove(p.m);
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            if (f.delay > 0) {
                f.delay -= dt;
                f.s.visible = false;
                continue;
            }
            f.s.visible = true;
            f.life -= dt;
            f.s.position.y += dt * 0.9;
            f.s.material.opacity = Math.min(1, f.life);
            if (f.life <= 0) {
                this.scene.remove(f.s);
                f.s.material.map.dispose();
                f.s.material.dispose();
                this.floaters.splice(i, 1);
            }
        }
    }

    /* ── Mini-games ────────────────────────────────────────────────── */

    setGame(view) {
        const id = view?.id || null;
        if (this.game && this.game.id !== id) {
            this.game.mod?.exit?.(this);
            this.game = null;
            this.clearBadges();
        }
        if (!view) {
            this.frozenUntil = 0;
            this.namesVisible = true;
            return;
        }
        this.serverOffset = view.now - Date.now();
        this.frozenUntil = view.frozenUntil || 0;
        this.namesVisible = !view.hideNames;
        if (!this.game) {
            this.game = { id, view, mod: GAME_MODULES[id] || null };
            if (!this.canFly()) this.flying = false;
            this.game.mod?.enter?.(this, view);
        } else {
            this.game.view = view;
            this.game.mod?.update?.(this, view);
        }
    }

    gameEvent(ev) {
        if (!this.game) return;
        this.game.mod?.event?.(this, ev, this.game.view);
    }

    /* ── The frame ─────────────────────────────────────────────────── */

    update(dt) {
        this.world.flush();
        if (this.riding) this.updateDriving(dt);
        else {
            this.updatePlayer(dt);
            this.repel(dt);
        }
        this.updateRemotes(dt);
        this.updateVehicles(dt);
        this.game?.mod?.tick?.(this, dt, this.game.view);
        this.updateCamera(dt);
        this.updateEffects(dt);

        const hit = this.view === 0 && !this.riding && !this.buildLocked() ? this.aim() : null;
        this.highlight.visible = !!hit;
        if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

        this.sendTimer += dt;
        if (this.sendTimer >= SEND_EVERY) {
            this.sendTimer = 0;
            this.sendMove();
        }
        this.hudTimer += dt;
        if (this.hudTimer > 0.25) {
            this.hudTimer = 0;
            const head = this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
            this.ui('hud', {
                zone: zoneAt(this.pos.x, this.pos.y, this.pos.z),
                coords: [Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)],
                flying: this.flying,
                underwater: head === WATER,
                view: this.view,
                frozen: this.serverNow() < this.frozenUntil,
                near: !this.riding ? KINDS[this.nearestVehicle()?.kind]?.name || null : null,
                riding: this.riding
                    ? { seat: this.riding.seat, name: KINDS[this.vehicles.get(this.riding.id)?.kind]?.name, kmh: Math.round(Math.abs(this.vehicles.get(this.riding.id)?.speed || 0) * 3.6) }
                    : null,
            });
        }
    }

    dispose() {
        cancelAnimationFrame(this.raf);
        this.stopRepeat();
        this.game?.mod?.exit?.(this);
        this.ro.disconnect();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('pointerlockchange', this.onLockChange);
        this.releaseLock();
        for (const r of this.remotes.values()) r.avatar.dispose();
        for (const v of this.vehicles.values()) v.dispose();
        this.myAvatar.dispose();
        this.world.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
