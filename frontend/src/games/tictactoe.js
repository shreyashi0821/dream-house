import * as THREE from 'three';
import { sfx } from '@/lib/sfx';
import { G, TICTAC, tictacCellAt } from '@shared/world.js';
import { disposeGroup } from './util';

/** Giant Tic-Tac-Toe: click a square on the garden board. */
const X_COLOUR = '#ff4d8d';
const O_COLOUR = '#3d8be0';

export default {
    noBuild: true,
    enter(e, v) {
        this.group = new THREE.Group();
        this.marks = [];
        e.scene.add(this.group);
        this.update(e, v);
    },
    makeMark(kind) {
        const g = new THREE.Group();
        if (kind === 'X') {
            const mat = new THREE.MeshLambertMaterial({ color: X_COLOUR, emissive: '#5a0f2a' });
            for (const r of [Math.PI / 4, -Math.PI / 4]) {
                const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.6, 0.45), mat);
                b.rotation.z = r;
                g.add(b);
            }
        } else {
            g.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.25, 10, 28), new THREE.MeshLambertMaterial({ color: O_COLOUR, emissive: '#0d2a55' })));
        }
        return g;
    },
    update(e, v) {
        for (const m of this.marks) disposeGroup({ scene: this.group }, m);
        this.marks = [];
        v.board.forEach((cell, i) => {
            if (!cell) return;
            const m = this.makeMark(cell);
            const [x, z] = TICTAC.cell(i % 3, Math.floor(i / 3));
            m.position.set(x, G + 2.2, z);
            m.userData.win = v.line?.includes(i);
            m.userData.phase = i;
            this.group.add(m);
            this.marks.push(m);
        });
    },
    tick(e, dt) {
        const t = performance.now() / 1000;
        for (const m of this.marks) {
            m.rotation.y = Math.sin(t + m.userData.phase) * 0.6;
            const s = m.userData.win ? 1.15 + Math.sin(t * 8) * 0.15 : 1;
            m.scale.setScalar(s);
            m.position.y = G + 2.2 + Math.sin(t * 2 + m.userData.phase) * 0.1;
        }
    },
    primary(e) {
        const hit = e.aim(32);
        if (hit && hit.y === G) {
            const cell = tictacCellAt(hit.x, hit.z);
            if (cell >= 0) e.net.send('game:action', { type: 'move', cell });
        }
        return true;
    },
    secondary() {
        return true;
    },
    event(e, ev) {
        if (ev.type === 'roundWin') (ev.by === e.meId ? sfx.win : sfx.lose)();
    },
    exit(e) {
        disposeGroup(e, this.group);
        this.marks = [];
    },
};
