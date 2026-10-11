import { G } from '../../shared/world.js';
import { base, runCountdown, dist, topScorers, finish, commonView, around } from './helpers.js';

/** Coin Rush: coins (1 point) and hearts (3 points) all over the house. */

const DURATION = 90_000;
const COINS = 40;
const HEARTS = 6;
const REACH = 3;
const START = [112.5, G + 1, 85.5]; // on the road, clear of the garden trees

export default {
    create(ctx, ids) {
        const spots = ctx.findSpots(COINS + HEARTS);
        const coins = spots.map(([x, y, z], i) => ({ id: i, x, y, z, v: i < HEARTS ? 3 : 1 }));
        ids.forEach((pid, i) => ctx.teleport(pid, around(START, i, ids.length, 3), Math.PI));
        return base(ctx, ids, { coins, total: coins.length });
    },

    action(s, ctx, pid, a) {
        if (a.type !== 'collect' || s.phase !== 'play') return false;
        const i = s.coins.findIndex((c) => c.id === a.id);
        if (i < 0) return false;
        const c = s.coins[i];
        if (dist(ctx.player(pid)?.pos, [c.x + 0.5, c.y, c.z + 0.5]) > REACH) return false;
        s.coins.splice(i, 1);
        s.scores[pid] += c.v;
        ctx.event({ type: 'coin', id: c.id, by: pid, v: c.v });
        if (!s.coins.length) this.end(s, ctx);
        return true;
    },

    end(s, ctx) {
        const winners = topScorers(s.scores, s.players);
        const best = s.scores[winners[0]] ?? 0;
        finish(s, winners, winners.length > 1 ? `A tie at ${best} points! 💞` : `${ctx.name(winners[0])} wins with ${best} points! 🪙`);
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
            coins: s.coins,
            total: s.total,
            scoreLabel: 'points',
            frozenUntil: s.startAt,
            hint: s.phase === 'play' ? `${s.coins.length} left — hearts are worth 3 💖` : '',
        };
    },
};
