import { sfx } from '@/lib/sfx';
import { nameOf, toast, headOf } from './util';

/** Pakdam Pakdai: a fire badge floats over whoever is "it". */
export default {
    noBuild: true,
    enter(e, v) {
        this.update(e, v);
    },
    update(e, v) {
        e.clearBadges();
        if (v.phase !== 'over') e.setBadge(v.it, '🔥');
    },
    event(e, ev) {
        if (ev.type !== 'tagged') return;
        sfx.hit();
        const at = headOf(e, ev.to);
        if (at) e.floatEmoji('💥', at, 1);
        toast(e, ev.to === e.meId ? 'Tagged! You are IT now 🔥' : `${nameOf(e, ev.to)} is IT now!`);
    },
    exit(e) {
        e.clearBadges();
    },
};
