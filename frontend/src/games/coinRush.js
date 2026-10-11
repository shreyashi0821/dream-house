import * as THREE from 'three';
import { sfx } from '@/lib/sfx';
import { emojiSprite } from '@/engine/avatar';
import { disposeGroup, nameOf } from './util';

/** Coin Rush: spinning coins and floating hearts; walk into them to collect. */
export default {
    noBuild: true,
    enter(e, v) {
        this.group = new THREE.Group();
        this.meshes = new Map();
        this.pending = new Map();
        this.coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 18);
        this.coinMat = new THREE.MeshLambertMaterial({ color: '#ffcf33', emissive: '#7a5200' });
        e.scene.add(this.group);
        this.update(e, v);
    },
    update(e, v) {
        const live = new Set(v.coins.map((c) => c.id));
        for (const [id, m] of this.meshes) {
            if (!live.has(id)) {
                this.group.remove(m);
                this.meshes.delete(id);
            }
        }
        for (const c of v.coins) {
            if (this.meshes.has(c.id)) continue;
            let m;
            if (c.v > 1) m = emojiSprite('💖', 0.85);
            else {
                m = new THREE.Mesh(this.coinGeo, this.coinMat);
                m.rotation.x = Math.PI / 2;
            }
            m.position.set(c.x + 0.5, c.y + 0.6, c.z + 0.5);
            m.userData = { ...c, phase: Math.random() * 6 };
            this.group.add(m);
            this.meshes.set(c.id, m);
        }
    },
    tick(e, dt, v) {
        const t = performance.now() / 1000;
        const me = new THREE.Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z);
        for (const m of this.meshes.values()) {
            const d = m.userData;
            m.position.y = d.y + 0.6 + Math.sin(t * 2.5 + d.phase) * 0.12;
            if (m.isMesh) m.rotation.z = t * 3 + d.phase;
            if (v.phase !== 'play') continue;
            const sent = this.pending.get(d.id);
            if (m.position.distanceTo(me) < 1.4 && (!sent || t - sent > 1)) {
                this.pending.set(d.id, t);
                e.net.send('game:action', { type: 'collect', id: d.id });
            }
        }
    },
    event(e, ev) {
        if (ev.type !== 'coin') return;
        const m = this.meshes.get(ev.id);
        if (m) {
            e.floatEmoji(ev.v > 1 ? '💖' : '✨', m.position.clone(), 0.6);
            this.group.remove(m);
            this.meshes.delete(ev.id);
        }
        if (ev.by === e.meId) {
            if (ev.v > 1) sfx.heart();
            else sfx.coin();
        } else if (ev.v > 1) e.ui('toast', { text: `${nameOf(e, ev.by)} grabbed a heart! 💖` });
    },
    exit(e) {
        disposeGroup(e, this.group);
        this.coinGeo?.dispose();
        this.meshes?.clear();
    },
};
