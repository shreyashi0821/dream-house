import * as THREE from 'three';

/**
 * A blocky player, built from boxes like the classic block-game character:
 * a pixel face painted on a canvas, swinging arms and legs, a name tag and
 * optional hats. The model faces -z, so rotation.y = yaw points it forward.
 */

const px = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
};

function faceTexture(look, side) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = look.skin;
    g.fillRect(0, 0, 8, 8);
    g.fillStyle = look.hair;
    const long = look.hairStyle === 'long';
    if (side === 'front') {
        g.fillRect(0, 0, 8, 2);
        g.fillRect(0, 2, 1, long ? 5 : 2);
        g.fillRect(7, 2, 1, long ? 5 : 2);
        // eyes
        g.fillStyle = '#ffffff';
        g.fillRect(1, 4, 2, 1);
        g.fillRect(5, 4, 2, 1);
        g.fillStyle = '#2b1d3a';
        g.fillRect(2, 4, 1, 1);
        g.fillRect(5, 4, 1, 1);
        // blush and a smile
        g.fillStyle = 'rgba(255,110,150,0.55)';
        g.fillRect(1, 5, 1, 1);
        g.fillRect(6, 5, 1, 1);
        g.fillStyle = '#b5485f';
        g.fillRect(3, 6, 2, 1);
    } else if (side === 'back') {
        g.fillRect(0, 0, 8, long || look.hairStyle === 'bun' ? 8 : 5);
    } else if (side === 'top') {
        g.fillRect(0, 0, 8, 8);
    } else {
        // 'right' is the +x face, whose back edge is the canvas's left; 'left' is the mirror.
        g.fillRect(0, 0, 8, 3);
        g.fillRect(side === 'right' ? 0 : 5, 0, 3, long ? 8 : 5);
    }
    return px(c);
}

const lambert = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
}

/** A text label that always faces the camera. */
export function textSprite(text, { size = 0.32, bg = 'rgba(20,10,30,0.55)', color = '#ffffff', font = 600 } = {}) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const fs = 44;
    g.font = `${font} ${fs}px Fredoka, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 36;
    c.width = w;
    c.height = fs + 22;
    g.font = `${font} ${fs}px Fredoka, sans-serif`;
    if (bg) {
        g.fillStyle = bg;
        g.beginPath();
        g.roundRect(0, 0, c.width, c.height, 18);
        g.fill();
    }
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set((size * c.width) / c.height, size, 1);
    s.renderOrder = 10;
    return s;
}

export function emojiSprite(emoji, size = 0.5) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.font = '78px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 48, 54);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
}

export class Avatar {
    constructor(look) {
        this.group = new THREE.Group();
        this.phase = 0;
        this.swing = 0;
        this.emote = null;
        this.emoteT = 0;
        this.build(look);
    }

    build(look) {
        this.look = { ...look };
        for (const ch of [...this.group.children]) {
            this.group.remove(ch);
            ch.traverse?.((o) => {
                o.geometry?.dispose();
                const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
                mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
            });
        }
        const skin = lambert(look.skin), shirt = lambert(look.shirt), pants = lambert(look.pants), hair = lambert(look.hair);
        const shoes = lambert('#2b2533');

        const root = new THREE.Group();
        this.group.add(root);
        this.root = root;

        const mkLeg = (x) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.7, 0);
            pivot.add(box(0.24, 0.6, 0.26, pants, 0, -0.3, 0));
            pivot.add(box(0.25, 0.1, 0.28, shoes, 0, -0.65, -0.01));
            root.add(pivot);
            return pivot;
        };
        this.legL = mkLeg(-0.125);
        this.legR = mkLeg(0.125);

        root.add(box(0.5, 0.65, 0.27, shirt, 0, 1.025, 0));

        const mkArm = (x) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 1.32, 0);
            pivot.add(box(0.2, 0.42, 0.22, shirt, 0, -0.2, 0));
            pivot.add(box(0.2, 0.22, 0.22, skin, 0, -0.52, 0));
            root.add(pivot);
            return pivot;
        };
        this.armL = mkArm(-0.36);
        this.armR = mkArm(0.36);

        const head = new THREE.Group();
        head.position.set(0, 1.35, 0);
        const fm = (side) => new THREE.MeshLambertMaterial({ map: faceTexture(look, side) });
        head.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), [fm('right'), fm('left'), fm('top'), skin, fm('back'), fm('front')]).translateY(0.23));
        if (look.hairStyle === 'long') head.add(box(0.48, 0.55, 0.08, hair, 0, 0.0, 0.23));
        if (look.hairStyle === 'bun') head.add(box(0.2, 0.18, 0.18, hair, 0, 0.5, 0.18));

        const hat = look.hat;
        if (hat === 'bow') {
            const pink = lambert('#ff4d8d');
            head.add(box(0.14, 0.14, 0.06, pink, 0.11, 0.5, 0.0));
            head.add(box(0.14, 0.14, 0.06, pink, -0.05, 0.5, 0.0).rotateZ(0.2));
            head.add(box(0.07, 0.07, 0.07, lambert('#ffd1e3'), 0.03, 0.5, 0.0));
        } else if (hat === 'cap') {
            head.add(box(0.5, 0.12, 0.5, shirt, 0, 0.5, 0));
            head.add(box(0.46, 0.04, 0.22, shirt, 0, 0.45, -0.32));
        } else if (hat === 'crown') {
            const gold = lambert('#ffcf33');
            head.add(box(0.48, 0.08, 0.48, gold, 0, 0.5, 0));
            for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.2]]) head.add(box(0.08, 0.12, 0.08, gold, x, 0.6, z));
            head.add(box(0.06, 0.06, 0.06, lambert('#ff3b5c'), 0, 0.52, -0.25));
        } else if (hat === 'flower') {
            head.add(box(0.14, 0.14, 0.06, lambert('#ff7eb3'), 0.22, 0.42, -0.1));
            head.add(box(0.06, 0.06, 0.07, lambert('#ffd23f'), 0.22, 0.42, -0.11));
        }
        root.add(head);
        this.head = head;

        this.root.traverse((o) => {
            if (o.isMesh) o.castShadow = false;
        });
    }

    setName(name) {
        if (this.tag) {
            this.group.remove(this.tag);
            this.tag.material.map.dispose();
            this.tag.material.dispose();
        }
        this.tag = textSprite(name);
        this.tag.position.y = 2.15;
        this.group.add(this.tag);
    }

    setBadge(emoji) {
        if (this.badgeEmoji === emoji) return;
        this.badgeEmoji = emoji;
        if (this.badge) {
            this.group.remove(this.badge);
            this.badge.material.map.dispose();
            this.badge.material.dispose();
            this.badge = null;
        }
        if (emoji) {
            this.badge = emojiSprite(emoji, 0.55);
            this.badge.position.y = 2.6;
            this.group.add(this.badge);
        }
    }

    play(kind) {
        this.emote = kind;
        this.emoteT = kind === 'dance' ? 2.4 : 1.6;
    }

    /** speed: horizontal speed in blocks/s */
    animate(dt, speed, pitch = 0) {
        const moving = speed > 0.3;
        this.phase += dt * Math.min(speed, 9) * 1.6;
        const target = moving ? Math.min(1, speed / 5) : 0;
        this.swing += (target - this.swing) * Math.min(1, dt * 10);
        const s = Math.sin(this.phase) * 0.9 * this.swing;
        this.legL.rotation.x = s;
        this.legR.rotation.x = -s;
        this.armL.rotation.x = -s * 0.8;
        this.armR.rotation.x = s * 0.8;
        this.armL.rotation.z = 0;
        this.armR.rotation.z = 0;
        this.root.rotation.y = 0;
        this.root.position.y = 0;
        this.head.rotation.x = -pitch * 0.6;

        if (this.sitting) {
            this.legL.rotation.x = this.legR.rotation.x = Math.PI / 2;
            this.armL.rotation.x = this.armR.rotation.x = 1.2;
        }

        if (this.emote) {
            this.emoteT -= dt;
            const t = this.emoteT;
            if (this.emote === 'wave' || this.emote === 'hearts' || this.emote === 'kiss') {
                this.armR.rotation.x = Math.PI;
                this.armR.rotation.z = Math.sin(t * 14) * 0.4;
            } else if (this.emote === 'dance') {
                this.root.rotation.y = t * 7;
                this.armL.rotation.x = this.armR.rotation.x = Math.PI;
                this.root.position.y = Math.abs(Math.sin(t * 10)) * 0.15;
            } else if (this.emote === 'laugh') {
                this.root.position.y = Math.abs(Math.sin(t * 18)) * 0.08;
                this.head.rotation.x = -0.3;
            }
            if (t <= 0) this.emote = null;
        }
    }

    dispose() {
        this.group.traverse((o) => {
            o.geometry?.dispose();
            const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
            mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
        });
    }
}
