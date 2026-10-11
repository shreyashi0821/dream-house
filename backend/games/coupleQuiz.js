import { base, shuffle, topScorers, finish, commonView } from './helpers.js';

/**
 * How Well Do You Know Me? Everyone answers about themselves first, then
 * guesses the next player's answers. Answers stay on the server until the
 * reveal, so nobody can peek.
 */

const QUESTIONS = [
    { q: 'My favourite food is…', o: ['Pizza', 'Biryani', 'Chocolate', 'Pani puri'] },
    { q: 'My dream holiday is…', o: ['Beach in the Maldives', 'Snowy Switzerland', 'Paris', 'A road trip to the hills'] },
    { q: 'On a free day I would rather…', o: ['Sleep all day', 'Binge a series', 'Go shopping', 'Play games'] },
    { q: 'My love language is…', o: ['Sweet words', 'Hugs', 'Gifts', 'Quality time'] },
    { q: "When I'm upset I want…", o: ['A hug', 'Snacks', 'Some space', 'To talk it out'] },
    { q: 'My favourite season is…', o: ['Summer', 'Monsoon', 'Winter', 'Spring'] },
    { q: 'The perfect date night is…', o: ['Candle-light dinner', 'Movie marathon', 'Long drive', 'Cooking together'] },
    { q: 'The superpower I want most…', o: ['Teleport to you', 'Read minds', 'Fly', 'Freeze time'] },
    { q: 'I am more of a…', o: ['Early bird', 'Night owl', 'Afternoon napper', 'Always sleepy'] },
    { q: 'My favourite drink is…', o: ['Chai', 'Coffee', 'Cold drink', 'Fresh juice'] },
    { q: 'The pet I would love…', o: ['Dog', 'Cat', 'Bunny', 'Fish'] },
    { q: 'The first thing I noticed about you…', o: ['Your eyes', 'Your smile', 'Your voice', 'Your humour'] },
    { q: 'My comfort movie genre…', o: ['Romance', 'Comedy', 'Horror', 'Action'] },
    { q: 'My dream home is a…', o: ['Beach house', 'Mountain cabin', 'City penthouse', 'Village farmhouse'] },
    { q: 'My favourite dessert…', o: ['Ice cream', 'Gulab jamun', 'Cake', 'Brownie'] },
    { q: 'If we had one day together I would…', o: ['Cuddle all day', 'Go on an adventure', 'Eat everywhere', 'Just talk for hours'] },
    { q: 'The song type I hum the most…', o: ['Bollywood romance', 'Old classics', 'Pop', 'Whatever is stuck in my head'] },
    { q: 'The chore I hate most…', o: ['Dishes', 'Laundry', 'Cleaning', 'Cooking'] },
];
const COUNT = 6;

const filled = (arr) => arr.every((v) => v !== null);

export default {
    create(ctx, ids) {
        const questions = shuffle(QUESTIONS).slice(0, COUNT);
        const s = base(ctx, ids, {
            questions,
            answers: Object.fromEntries(ids.map((p) => [p, Array(COUNT).fill(null)])),
            guesses: Object.fromEntries(ids.map((p) => [p, Array(COUNT).fill(null)])),
            targets: Object.fromEntries(ids.map((p, i) => [p, ids[(i + 1) % ids.length]])),
        });
        s.phase = 'answer';
        return s;
    },

    action(s, ctx, pid, a) {
        const q = Number(a.q), o = Number(a.o);
        if (!Number.isInteger(q) || q < 0 || q >= COUNT || !Number.isInteger(o) || o < 0 || o > 3) return false;
        if (a.type === 'answer' && s.phase === 'answer') {
            s.answers[pid][q] = o;
            if (s.players.every((p) => filled(s.answers[p]))) s.phase = 'guess';
            return true;
        }
        if (a.type === 'guess' && s.phase === 'guess') {
            s.guesses[pid][q] = o;
            if (s.players.every((p) => filled(s.guesses[p]))) {
                for (const p of s.players) {
                    const t = s.targets[p];
                    s.scores[p] = s.guesses[p].filter((g, i) => g === s.answers[t][i]).length;
                }
                const winners = topScorers(s.scores, s.players);
                const best = s.scores[winners[0]];
                const msg =
                    best === COUNT && winners.length === s.players.length
                        ? 'Perfect scores! You two are made for each other 💞'
                        : winners.length > 1
                          ? `A tie at ${best}/${COUNT}! 💞`
                          : `${ctx.name(winners[0])} knows their partner best with ${best}/${COUNT}! 💘`;
                finish(s, winners, msg);
            }
            return true;
        }
        return false;
    },

    leave(s) {
        if (s.phase !== 'over' && s.players.length < 2) finish(s, s.players, 'Your partner left the quiz.');
        for (const p of s.players) if (!s.players.includes(s.targets[p])) s.targets[p] = s.players.find((x) => x !== p) || p;
    },

    view(s, pid, ctx) {
        const reveal = s.phase === 'over';
        const progress = Object.fromEntries(
            s.players.map((p) => [p, (s.phase === 'answer' ? s.answers[p] : s.guesses[p]).filter((v) => v !== null).length])
        );
        const target = s.targets[pid];
        return {
            ...commonView(s),
            questions: s.questions,
            count: COUNT,
            progress,
            target,
            targetName: ctx.name(target),
            mine: s.phase === 'answer' ? s.answers[pid] : s.guesses[pid],
            answers: reveal ? s.answers : null,
            guesses: reveal ? s.guesses : null,
            targets: reveal ? s.targets : null,
            scoreLabel: 'correct',
            overlay: true,
        };
    },
};
