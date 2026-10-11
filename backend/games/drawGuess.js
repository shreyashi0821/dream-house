import { base, shuffle, topScorers, finish, commonView } from './helpers.js';

/**
 * Draw & Guess. Strokes go out as events the moment they are drawn and are
 * also kept in state, so someone who reconnects mid-round still sees the
 * whole drawing.
 */

const WORDS = [
    'heart', 'pizza', 'cat', 'house', 'moon', 'rose', 'ring', 'cake', 'chocolate', 'beach', 'sun', 'flower',
    'star', 'car', 'rainbow', 'ice cream', 'teddy bear', 'coffee', 'balloon', 'butterfly', 'guitar', 'umbrella',
    'tree', 'fish', 'kite', 'rocket', 'cupcake', 'pineapple', 'snowman', 'dog', 'crown', 'gift', 'airplane',
    'banana', 'camera', 'castle', 'panda', 'mountain', 'phone', 'sunflower', 'burger', 'donut', 'bicycle',
    'penguin', 'cloud', 'candle', 'kiss', 'rain', 'boat', 'train', 'apple', 'samosa', 'mango', 'tea',
];
const ROUND_MS = 80_000;
const REVEAL_MS = 4000;
const MAX_STROKES = 800;

const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z]/g, '');

function startRound(s, ctx) {
    s.drawer = s.players[s.round % s.players.length];
    s.word = s.deck[s.round % s.deck.length];
    s.strokes = [];
    s.guessed = [];
    s.phase = 'draw';
    s.endsAt = ctx.now + ROUND_MS;
    s.message = '';
}

export default {
    create(ctx, ids) {
        const s = base(ctx, ids, {
            deck: shuffle(WORDS),
            round: 0,
            rounds: Math.min(6, ids.length * 2),
            drawer: null,
            word: '',
            strokes: [],
            guessed: [],
            revealAt: null,
        });
        startRound(s, ctx);
        return s;
    },

    action(s, ctx, pid, a) {
        if (s.phase !== 'draw') return false;
        if (a.type === 'stroke' && pid === s.drawer) {
            const p = a.p;
            if (!Array.isArray(p) || p.length < 1 || p.length > 300 || s.strokes.length >= MAX_STROKES) return false;
            if (!p.every((pt) => Array.isArray(pt) && pt.length === 2 && pt.every((n) => typeof n === 'number' && n >= 0 && n <= 1))) return false;
            const stroke = {
                c: /^#[0-9a-f]{6}$/i.test(a.c) ? a.c : '#222222',
                s: Math.max(1, Math.min(40, Number(a.s) || 4)),
                p: p.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]),
            };
            s.strokes.push(stroke);
            ctx.event({ type: 'stroke', stroke });
            return false;
        }
        if (a.type === 'clear' && pid === s.drawer) {
            s.strokes = [];
            return true;
        }
        if (a.type === 'guess' && pid !== s.drawer && !s.guessed.includes(pid)) {
            const text = String(a.text || '').slice(0, 40);
            if (!text.trim()) return false;
            if (norm(text) === norm(s.word)) {
                const left = Math.max(0, s.endsAt - ctx.now);
                s.scores[pid] += 1 + Math.ceil(left / 16_000);
                s.scores[s.drawer] += 2;
                s.guessed.push(pid);
                ctx.event({ type: 'guess', from: pid, correct: true });
                if (s.players.filter((p) => p !== s.drawer).every((p) => s.guessed.includes(p))) this.reveal(s, ctx, `${ctx.name(pid)} got it!`);
                return true;
            }
            ctx.event({ type: 'guess', from: pid, text, close: Math.abs(norm(text).length - norm(s.word).length) <= 1 && norm(text)[0] === norm(s.word)[0] });
            return false;
        }
        return false;
    },

    reveal(s, ctx, message) {
        s.phase = 'reveal';
        s.revealAt = ctx.now + REVEAL_MS;
        s.endsAt = s.revealAt;
        s.message = `${message} The word was "${s.word}".`;
    },

    tick(s, ctx) {
        if (s.phase === 'draw' && ctx.now >= s.endsAt) {
            this.reveal(s, ctx, 'Time is up!');
            return true;
        }
        if (s.phase === 'reveal' && ctx.now >= s.revealAt) {
            s.round += 1;
            if (s.round >= s.rounds) {
                const winners = topScorers(s.scores, s.players);
                finish(s, winners, winners.length > 1 ? 'A tie! Two great artists 🎨' : `${ctx.name(winners[0])} wins Draw & Guess! 🎨`);
            } else startRound(s, ctx);
            return true;
        }
        return false;
    },

    leave(s, ctx, pid) {
        if (s.phase === 'over') return;
        if (s.players.length < 2) finish(s, s.players, 'Your partner left the game.');
        else if (pid === s.drawer) this.reveal(s, ctx, 'The artist left.');
    },

    view(s, pid) {
        const showWord = pid === s.drawer || s.phase !== 'draw';
        return {
            ...commonView(s),
            drawer: s.drawer,
            word: showWord ? s.word : null,
            mask: s.word.replace(/[a-z]/gi, '_').split('').join(' '),
            letters: s.word.replace(/ /g, '').length,
            strokes: s.strokes,
            guessed: s.guessed,
            round: Math.min(s.round + 1, s.rounds),
            rounds: s.rounds,
            scoreLabel: 'points',
            overlay: true,
        };
    },
};
