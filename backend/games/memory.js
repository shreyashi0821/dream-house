import { G } from '../../shared/world.js';
import { base, shuffle, topScorers, finish, commonView, around } from './helpers.js';

/** Memory Match: sixteen giant cards, eight pairs. Find a pair and go again. */

const FACES = ['💖', '🌹', '🍫', '🧸', '🍕', '🌙', '🐱', '🎮'];
const PEEK_MS = 1300;

export default {
    create(ctx, ids) {
        ids.forEach((pid, i) => ctx.teleport(pid, around([78.5, G + 1, 130.5], i, ids.length, 1.5), 0)); // reads like the grid on screen
        const s = base(ctx, ids, {
            cards: shuffle([...FACES, ...FACES]).map((e) => ({ e, by: null })),
            turn: 0,
            open: [],
            hideAt: null,
        });
        s.phase = 'play';
        return s;
    },

    action(s, ctx, pid, a) {
        if (a.type !== 'flip' || s.phase !== 'play' || s.hideAt) return false;
        if (s.players[s.turn % s.players.length] !== pid) return false;
        const i = Number(a.i);
        const card = s.cards[i];
        if (!card || card.by || s.open.includes(i) || s.open.length >= 2) return false;
        s.open.push(i);
        if (s.open.length === 2) {
            const [p, q] = s.open;
            if (s.cards[p].e === s.cards[q].e) {
                s.cards[p].by = s.cards[q].by = pid;
                s.scores[pid] += 1;
                s.open = [];
                ctx.event({ type: 'pair', by: pid, e: s.cards[p].e });
                if (s.cards.every((c) => c.by)) {
                    const winners = topScorers(s.scores, s.players);
                    finish(s, winners, winners.length > 1 ? 'A perfect tie! 💞' : `${ctx.name(winners[0])} found the most pairs! 🃏`);
                }
            } else {
                s.hideAt = ctx.now + PEEK_MS;
            }
        }
        return true;
    },

    tick(s, ctx) {
        if (!s.hideAt || ctx.now < s.hideAt) return false;
        s.open = [];
        s.hideAt = null;
        s.turn = (s.turn + 1) % s.players.length;
        return true;
    },

    leave(s) {
        s.turn %= Math.max(1, s.players.length);
    },

    view(s, pid) {
        const turnPid = s.players[s.turn % s.players.length];
        return {
            ...commonView(s),
            cards: s.cards.map((c, i) => ({ e: c.by || s.open.includes(i) ? c.e : null, by: c.by })),
            open: s.open,
            turn: turnPid,
            scoreLabel: 'pairs',
            hint: s.phase !== 'play' ? '' : turnPid === pid ? 'Your turn — click two cards on the board (or below)' : 'Your partner is flipping…',
        };
    },
};
