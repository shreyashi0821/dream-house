import * as THREE from 'three';
import { sfx } from '@/lib/sfx';
import { G, MEMORY, memoryCardAt } from '@shared/world.js';
import { disposeGroup, colourOf } from './util';

/** Memory Match: sixteen giant cards lying on the board that flip over. */

function cardTexture(emoji, bg) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, 120, 120, 18);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.stroke();
    g.font = emoji === '?' ? 'bold 80px Fredoka, sans-serif' : '78px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText(emoji, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export default {
    noBuild: true,
    enter(e, v) {
        this.group = new THREE.Group();
        this.cards = [];
        const plane = new THREE.PlaneGeometry(1.8, 1.8).rotateX(-Math.PI / 2);
        const backMat = new THREE.MeshBasicMaterial({ map: cardTexture('?', '#8a5cf6') });
        for (let i = 0; i < 16; i++) {
            const [x, z] = MEMORY.card(i % 4, Math.floor(i / 4));
            const pivot = new THREE.Group();
            pivot.position.set(x, G + 1.06, z);
            const back = new THREE.Mesh(plane, backMat);
            const front = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ transparent: true }));
            front.rotation.z = Math.PI;
            front.position.y = -0.01;
            pivot.add(back, front);
            this.group.add(pivot);
            this.cards.push({ pivot, front, shown: false, key: '', angle: 0 });
        }
        e.scene.add(this.group);
        this.update(e, v);
    },
    update(e, v) {
        v.cards.forEach((c, i) => {
            const card = this.cards[i];
            card.shown = !!c.e;
            const key = c.e ? `${c.e}|${c.by || ''}` : '';
            if (key && key !== card.key) {
                card.front.material.map?.dispose();
                card.front.material.map = cardTexture(c.e, c.by ? colourOf(e, c.by) : '#ffb3cf');
                card.front.material.needsUpdate = true;
                card.key = key;
            }
        });
    },
    tick(e, dt) {
        for (const c of this.cards) {
            const target = c.shown ? Math.PI : 0;
            c.angle += (target - c.angle) * Math.min(1, dt * 10);
            c.pivot.rotation.z = c.angle;
            c.pivot.position.y = G + 1.06 + Math.sin(c.angle) * 0.6;
        }
    },
    primary(e) {
        const hit = e.aim(32);
        if (hit && hit.y === G) {
            const i = memoryCardAt(hit.x, hit.z);
            if (i >= 0) e.net.send('game:action', { type: 'flip', i });
        }
        return true;
    },
    secondary() {
        return true;
    },
    event(e, ev) {
        if (ev.type === 'pair') {
            sfx.coin();
            e.floatEmoji(ev.e, new THREE.Vector3(78.5, G + 3, 122.5), 1.4);
        }
    },
    exit(e) {
        disposeGroup(e, this.group);
        this.cards = [];
    },
};
