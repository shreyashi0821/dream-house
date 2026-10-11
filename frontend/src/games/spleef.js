import { sfx } from '@/lib/sfx';
import { SPLEEF } from '@shared/world.js';
import { nameOf, toast, headOf } from './util';

/** Spleef: breaking is normal clicking; we only report falling into the water. */
export default {
    enter() {
        this.fellSent = false;
    },
    secondary(e, v) {
        // No placing blocks to save yourself 😉
        return v.phase !== 'over';
    },
    tick(e, dt, v) {
        if (v.phase !== 'play' || this.fellSent || !v.alive.includes(e.meId)) return;
        const inside = e.pos.x >= SPLEEF.x0 && e.pos.x <= SPLEEF.x1 + 1 && e.pos.z >= SPLEEF.z0 && e.pos.z <= SPLEEF.z1 + 1;
        if (inside && e.pos.y < SPLEEF.y - 0.5) {
            this.fellSent = true;
            e.net.send('game:action', { type: 'fell' });
        }
    },
    event(e, ev) {
        if (ev.type !== 'splash') return;
        sfx.splash();
        const at = headOf(e, ev.who);
        if (at) e.floatEmoji('💦', at, 1);
        toast(e, ev.who === e.meId ? 'Splash! You fell in 💦' : `${nameOf(e, ev.who)} fell in! 💦`);
    },
};
