import { sfx } from '@/lib/sfx';
import { nameOf, toast, headOf } from './util';

/** Hide & Seek: the seeker clicks on someone they can see to find them. */
export default {
    noBuild: true,
    enter(e, v) {
        this.update(e, v);
    },
    update(e, v) {
        e.clearBadges();
        if (v.phase !== 'over') e.setBadge(v.seeker, '🔎');
        for (const id of v.found || []) e.setBadge(id, '😅');
    },
    primary(e, v) {
        if (v.seeker === e.meId && v.phase === 'seeking') {
            const target = e.pickPlayer(4.5);
            if (target && !v.found.includes(target)) e.net.send('game:action', { type: 'found', target });
        }
        return true;
    },
    event(e, ev) {
        if (ev.type === 'seek') {
            sfx.go();
            toast(e, 'Ready or not, here I come! 🔎');
        }
        if (ev.type === 'found') {
            sfx.coin();
            const at = headOf(e, ev.target);
            if (at) e.floatEmoji('👀', at, 1);
            toast(e, ev.target === e.meId ? 'Found you! 😆' : `Found ${nameOf(e, ev.target)}!`);
        }
    },
    exit(e) {
        e.clearBadges();
    },
};
