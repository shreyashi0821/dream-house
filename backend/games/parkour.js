import { PARKOUR } from '../../shared/world.js';
import { base, runCountdown, finish, commonView, around } from './helpers.js';

/** Sky Parkour: a race over floating blocks, with gold checkpoints. */

const DURATION = 300_000;
const CPS = PARKOUR.checkpoints.length;

export default {
    create(ctx, ids) {
        ids.forEach((pid, i) => ctx.teleport(pid, around(PARKOUR.start, i, ids.length, 1.2), Math.PI / 2));
        return base(ctx, ids, {
            progress: Object.fromEntries(ids.map((p) => [p, 0])),
            times: {},
        });
    },

    action(s, ctx, pid, a) {
        if (s.phase !== 'play' || s.times[pid]) return false;
        if (a.type === 'checkpoint') {
            const i = Number(a.i);
            if (!Number.isInteger(i) || i <= s.progress[pid] || i > Math.min(CPS, s.progress[pid] + 1)) return false;
            s.progress[pid] = i;
            s.scores[pid] = i;
            ctx.event({ type: 'checkpoint', by: pid, i });
            return true;
        }
        if (a.type === 'finish') {
            if (s.progress[pid] < CPS) return false;
            s.times[pid] = ctx.now - s.startAt;
            s.scores[pid] = CPS + 1;
            ctx.event({ type: 'finished', by: pid, ms: s.times[pid] });
            if (s.players.every((p) => s.times[p])) this.end(s, ctx);
            return true;
        }
        return false;
    },

    end(s, ctx) {
        const done = s.players.filter((p) => s.times[p]).sort((a, b) => s.times[a] - s.times[b]);
        if (done.length) {
            finish(s, [done[0]], `${ctx.name(done[0])} finished first in ${(s.times[done[0]] / 1000).toFixed(1)}s! 🏁`);
        } else {
            const best = Math.max(...s.players.map((p) => s.progress[p]));
            finish(s, s.players.filter((p) => s.progress[p] === best), 'Time is up! Furthest checkpoint wins.');
        }
    },

    tick(s, ctx) {
        if (runCountdown(s, ctx, DURATION)) return true;
        if (s.phase === 'play' && ctx.now >= s.endsAt) {
            this.end(s, ctx);
            return true;
        }
        return false;
    },

    view(s) {
        return {
            ...commonView(s),
            progress: s.progress,
            times: s.times,
            checkpoints: CPS,
            scoreLabel: 'checkpoints',
            frozenUntil: s.startAt,
            hint: s.phase === 'play' ? 'Jump across! Hold Shift to sprint for the long gaps 🧗' : '',
        };
    },
};
