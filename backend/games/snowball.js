import { SNOW_FIELD } from '../../shared/world.js';
import { base, runCountdown, dist, topScorers, finish, commonView, validVec } from './helpers.js';

/**
 * Snowball Fight. The thrower's browser works out whether a snowball hit, the
 * server only checks it was plausible (in range, not faster than an arm can
 * throw) before counting it.
 */

const DURATION = 150_000;
const TARGET = 10;
const HIT_GAP = 300;
const THROW_GAP = 200;

export default {
    create(ctx, ids) {
        ids.forEach((pid, i) => {
            const side = i % 2 === 0 ? SNOW_FIELD.a : SNOW_FIELD.b;
            const row = Math.floor(i / 2) * 2;
            ctx.teleport(pid, [side[0], side[1], side[2] - row], i % 2 === 0 ? -Math.PI / 2 : Math.PI / 2);
        });
        return base(ctx, ids, { lastHit: {}, lastThrow: {} });
    },

    action(s, ctx, pid, a) {
        if (s.phase !== 'play') return false;
        if (a.type === 'throw') {
            if (!validVec(a.o) || !validVec(a.d)) return false;
            if (ctx.now - (s.lastThrow[pid] || 0) < THROW_GAP) return false;
            s.lastThrow[pid] = ctx.now;
            ctx.event({ type: 'snowball', from: pid, o: a.o, d: a.d });
            return false;
        }
        if (a.type === 'hit') {
            if (a.target === pid || !s.players.includes(a.target)) return false;
            if (ctx.now - (s.lastHit[pid] || 0) < HIT_GAP) return false;
            if (dist(ctx.player(pid)?.pos, ctx.player(a.target)?.pos) > 60) return false;
            s.lastHit[pid] = ctx.now;
            s.scores[pid] += 1;
            ctx.event({ type: 'hit', from: pid, to: a.target });
            if (s.scores[pid] >= TARGET) finish(s, [pid], `${ctx.name(pid)} wins the snowball fight! ❄️`);
            return true;
        }
        return false;
    },

    tick(s, ctx) {
        if (runCountdown(s, ctx, DURATION)) return true;
        if (s.phase === 'play' && ctx.now >= s.endsAt) {
            const winners = topScorers(s.scores, s.players);
            finish(s, winners, winners.length > 1 ? 'A snowy tie! ☃️' : `${ctx.name(winners[0])} wins the snowball fight! ❄️`);
            return true;
        }
        return false;
    },

    leave(s) {
        if (s.players.length < 2 && s.phase !== 'over') finish(s, s.players, 'Your partner left the game.');
    },

    view(s) {
        return {
            ...commonView(s),
            scoreLabel: 'hits',
            target: TARGET,
            frozenUntil: s.startAt,
            hint: s.phase === 'play' ? 'Click to throw a snowball ❄️ First to 10 hits!' : '',
        };
    },
};
