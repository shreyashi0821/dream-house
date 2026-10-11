import { G } from '../../shared/world.js';
import { base, dist, pick, finish, commonView, around } from './helpers.js';

/** Hide & Seek: the seeker counts blind while everyone hides in the house. */

const HIDE_MS = 30_000;
const SEEK_MS = 150_000;
const FIND_RANGE = 4.5;
const AUTO_FIND = 1.3;
const START = [112.5, G + 1, 85.5]; // on the road, clear of the garden trees

export default {
    create(ctx, ids) {
        const seeker = pick(ids);
        ids.forEach((pid, i) => ctx.teleport(pid, around(START, i, ids.length, 2), Math.PI));
        const s = base(ctx, ids, { seeker, found: [] });
        s.phase = 'hiding';
        s.startAt = ctx.now;
        s.endsAt = ctx.now + HIDE_MS;
        return s;
    },

    action(s, ctx, pid, a) {
        if (a.type !== 'found' || s.phase !== 'seeking' || pid !== s.seeker) return false;
        if (!s.players.includes(a.target) || a.target === s.seeker || s.found.includes(a.target)) return false;
        if (dist(ctx.player(pid)?.pos, ctx.player(a.target)?.pos) > FIND_RANGE) return false;
        return this.markFound(s, ctx, a.target);
    },

    markFound(s, ctx, target) {
        s.found.push(target);
        s.scores[s.seeker] = s.found.length;
        ctx.event({ type: 'found', by: s.seeker, target });
        const hiders = s.players.filter((p) => p !== s.seeker);
        if (hiders.every((p) => s.found.includes(p))) {
            finish(s, [s.seeker], `${ctx.name(s.seeker)} found everyone! 🔎`);
        }
        return true;
    },

    tick(s, ctx) {
        if (s.phase === 'hiding' && ctx.now >= s.endsAt) {
            s.phase = 'seeking';
            s.endsAt = ctx.now + SEEK_MS;
            ctx.event({ type: 'seek' });
            return true;
        }
        if (s.phase !== 'seeking') return false;
        const seekerPos = ctx.player(s.seeker)?.pos;
        for (const p of s.players) {
            if (p !== s.seeker && !s.found.includes(p) && dist(ctx.player(p)?.pos, seekerPos) < AUTO_FIND) {
                this.markFound(s, ctx, p);
                return true;
            }
        }
        if (ctx.now >= s.endsAt) {
            const hidden = s.players.filter((p) => p !== s.seeker && !s.found.includes(p));
            finish(s, hidden, `${hidden.map(ctx.name).join(' & ')} stayed hidden! 🫣`);
            return true;
        }
        return false;
    },

    leave(s, ctx) {
        if (s.phase === 'over') return;
        if (!s.players.includes(s.seeker) || s.players.length < 2) finish(s, s.players, 'The game ended because someone left.');
    },

    view(s, pid) {
        const seeker = pid === s.seeker;
        let hint = '';
        if (s.phase === 'hiding') hint = seeker ? 'Eyes closed! Counting… 🙈' : 'Quick, hide somewhere in the house! 🏃';
        else if (s.phase === 'seeking') hint = seeker ? 'Find them! Click on someone when you spot them 🔎' : s.found.includes(pid) ? 'You were found 😅' : 'Stay hidden… 🤫';
        return {
            ...commonView(s),
            seeker: s.seeker,
            found: s.found,
            scoreLabel: 'found',
            blind: seeker && s.phase === 'hiding',
            frozenUntil: seeker && s.phase === 'hiding' ? s.endsAt : 0,
            hideNames: seeker && s.phase !== 'over',
            hint,
        };
    },
};
