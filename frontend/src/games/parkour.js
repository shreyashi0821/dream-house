import * as THREE from 'three';
import { sfx } from '@/lib/sfx';
import { PARKOUR } from '@shared/world.js';
import { GOLD, EMERALD } from '@shared/blocks.js';
import { nameOf, toast, disposeGroup } from './util';

/**
 * Sky Parkour. Your browser notices you landing on a gold checkpoint or the
 * emerald finish and tells the server; falling puts you back on your last
 * checkpoint.
 */
export default {
    noBuild: true,
    enter(e) {
        this.sent = 0;
        this.finished = false;
        this.group = new THREE.Group();
        this.beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 30, 12, 1, true),
            new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
        );
        this.group.add(this.beacon);
        e.scene.add(this.group);
    },
    respawnPoint(progress) {
        return progress > 0 ? PARKOUR.checkpoints[progress - 1] : PARKOUR.start;
    },
    tick(e, dt, v) {
        const prog = Math.max(v.progress?.[e.meId] || 0, this.sent);
        const next = prog < v.checkpoints ? PARKOUR.checkpoints[prog] : PARKOUR.finish;
        this.beacon.position.set(next[0], next[1] + 15, next[2]);
        this.beacon.rotation.y += dt;
        if (v.phase !== 'play' || v.times?.[e.meId] || this.finished) return;

        const below = e.world.get(Math.floor(e.pos.x), Math.floor(e.pos.y - 0.1), Math.floor(e.pos.z));
        if (below === GOLD && e.onGround) {
            const i = PARKOUR.checkpoints.findIndex((c) => Math.hypot(c[0] - e.pos.x, c[2] - e.pos.z) < 3 && Math.abs(c[1] - e.pos.y) < 1.5);
            if (i + 1 === prog + 1 && this.sent < i + 1) {
                this.sent = i + 1;
                e.net.send('game:action', { type: 'checkpoint', i: i + 1 });
            }
        }
        if (below === EMERALD && e.onGround && prog >= v.checkpoints) {
            this.finished = true;
            e.net.send('game:action', { type: 'finish' });
        }
        if (e.pos.y < PARKOUR.fallY) {
            e.teleport(this.respawnPoint(prog), Math.PI / 2);
            sfx.splash();
            toast(e, prog ? 'Back to your checkpoint 💪' : 'Back to the start — you got this 💪');
        }
    },
    event(e, ev) {
        if (ev.type === 'checkpoint' && ev.by === e.meId) {
            sfx.coin();
            toast(e, `Checkpoint ${ev.i}! ⭐`);
        }
        if (ev.type === 'finished') {
            if (ev.by === e.meId) sfx.win();
            toast(e, `${nameOf(e, ev.by)} finished in ${(ev.ms / 1000).toFixed(1)}s! 🏁`);
        }
    },
    exit(e) {
        disposeGroup(e, this.group);
    },
};
