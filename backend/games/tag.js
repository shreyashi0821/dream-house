import { G } from '../../shared/world.js';
import { base, runCountdown, dist, pick, topScorers, finish, commonView, around } from './helpers.js';

/** Pakdam Pakdai: whoever is "it" catches someone by touching them. */

const DURATION = 120_000;
const HEAD_START = 2500;
const TAG_RANGE = 1.8;
const TAG_COOLDOWN = 2500;
const START = [112.5, G + 1, 85.5]; // on the road, clear of the garden trees

export default {
    create(ctx, ids) {
        const it = pick(ids);
        ids.forEach((pid, i) => ctx.teleport(pid, around(START, i, ids.length, 6), Math.PI));
        return base(ctx, ids, { it, itMs: Object.fromEntries(ids.map((p) => [p, 0])), lastTag: 0, lastTick: ctx.now, lastSent: 0 });
    },

    action() {
        return false;
    },

    tick(s, ctx) {
        let changed = runCountdown(s, ctx, DURATION);
        const dt = ctx.now - s.lastTick;
        s.lastTick = ctx.now;
        if (s.phase !== 'play') return changed;

        s.itMs[s.it] = (s.itMs[s.it] || 0) + dt;
        const itPos = ctx.player(s.it)?.pos;
        if (ctx.now - s.lastTag > TAG_COOLDOWN && ctx.now - s.startAt > HEAD_START) {
            const caught = s.players.find((p) => p !== s.it && dist(ctx.player(p)?.pos, itPos) < TAG_RANGE);
            if (caught) {
                ctx.event({ type: 'tagged', from: s.it, to: caught });
                s.it = caught;
                s.lastTag = ctx.now;
                changed = true;
            }
        }
        if (ctx.now >= s.endsAt) {
            const winners = topScorers(s.itMs, s.players, true);
            finish(s, winners, `${winners.map(ctx.name).join(' & ')} spent the least time as "it"!`);
            return true;
        }
        if (ctx.now - s.lastSent > 1000) {
            s.lastSent = ctx.now;
            changed = true;
        }
        return changed;
    },

    leave(s) {
        if (!s.players.includes(s.it)) s.it = s.players[0];
        if (s.players.length < 2 && s.phase !== 'over') finish(s, s.players, 'Your partner left the game.');
    },

    view(s, pid) {
        const scores = Object.fromEntries(s.players.map((p) => [p, Math.round((s.itMs[p] || 0) / 1000)]));
        return {
            ...commonView(s),
            scores,
            scoreLabel: 'sec as "it"',
            lowerIsBetter: true,
            it: s.it,
            frozenUntil: pid === s.it ? s.startAt + HEAD_START : s.startAt,
            hint: s.phase === 'over' ? '' : pid === s.it ? 'You are IT! Run and touch your partner 🔥' : 'Run away from the one who is IT!',
        };
    },
};
