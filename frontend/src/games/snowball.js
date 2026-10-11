import * as THREE from 'three';
import { sfx } from '@/lib/sfx';
import { SNOW } from '@shared/blocks.js';
import { nameOf, toast, headOf } from './util';

/**
 * Snowball Fight. Every browser simulates every snowball for the visuals, but
 * only the thrower's decides whether it hit — then the server keeps score.
 */
const SPEED = 30;
const GRAV = 14;

export default {
    noBuild: true,
    enter(e) {
        this.balls = [];
        this.last = 0;
        this.geo = new THREE.SphereGeometry(0.14, 10, 8);
        this.mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#334455' });
        e.setHandBlock(SNOW);
    },
    spawn(e, o, v, mine) {
        const m = new THREE.Mesh(this.geo, this.mat);
        m.position.set(o[0], o[1], o[2]);
        e.scene.add(m);
        this.balls.push({ m, v: new THREE.Vector3(v[0], v[1], v[2]), mine, life: 3 });
    },
    primary(e, v) {
        if (v.phase !== 'play') return true;
        const now = performance.now();
        if (now - this.last < 250) return true;
        this.last = now;
        const dir = e.lookDir();
        const o = e.eye().addScaledVector(dir, 0.5);
        const vel = dir.multiplyScalar(SPEED).add(new THREE.Vector3(0, 2.5, 0));
        const oa = [o.x, o.y, o.z].map((n) => Math.round(n * 100) / 100);
        const va = [vel.x, vel.y, vel.z].map((n) => Math.round(n * 100) / 100);
        this.spawn(e, oa, va, true);
        e.net.send('game:action', { type: 'throw', o: oa, d: va });
        e.swingHand();
        sfx.throw();
        return true;
    },
    secondary() {
        return true;
    },
    tick(e, dt) {
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            b.life -= dt;
            const p = b.m.position;
            let gone = b.life <= 0;
            // Small steps, so a fast snowball cannot skip clean through someone.
            const steps = Math.max(1, Math.ceil((b.v.length() * dt) / 0.2));
            const h = dt / steps;
            for (let s = 0; s < steps && !gone; s++) {
                b.v.y -= GRAV * h;
                p.addScaledVector(b.v, h);
                if (e.world.solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
                    e.burst(p.x, p.y, p.z, SNOW, 6);
                    gone = true;
                    break;
                }
                if (!b.mine) continue;
                for (const r of e.remotes.values()) {
                    if (Math.abs(p.x - r.pos.x) < 0.5 && Math.abs(p.z - r.pos.z) < 0.5 && p.y > r.pos.y - 0.1 && p.y < r.pos.y + 2) {
                        e.net.send('game:action', { type: 'hit', target: r.id });
                        e.burst(p.x, p.y, p.z, SNOW, 8);
                        gone = true;
                        break;
                    }
                }
            }
            if (gone) {
                e.scene.remove(b.m);
                this.balls.splice(i, 1);
            }
        }
    },
    event(e, ev) {
        if (ev.type === 'snowball' && ev.from !== e.meId) this.spawn(e, ev.o, ev.d, false);
        if (ev.type === 'hit') {
            const at = headOf(e, ev.to);
            if (at) e.floatEmoji('❄️', at, 0.8);
            if (ev.to === e.meId) {
                const from = e.playerPos(ev.from);
                if (from) e.knock(new THREE.Vector3(e.pos.x - from.x, 0, e.pos.z - from.z), 6);
                sfx.hit();
                e.ui('flash', 'hit');
            } else if (ev.from === e.meId) {
                sfx.pop();
                toast(e, `Hit ${nameOf(e, ev.to)}! ❄️`);
            }
        }
    },
    exit(e) {
        for (const b of this.balls || []) e.scene.remove(b.m);
        this.balls = [];
        this.geo?.dispose();
        this.mat?.dispose();
        e.setHandBlock(e.held);
    },
};
