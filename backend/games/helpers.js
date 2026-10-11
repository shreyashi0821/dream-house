/** Little pieces every game's rules share. */

export const COUNTDOWN_MS = 3000;

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const zeros = (ids) => Object.fromEntries(ids.map((id) => [id, 0]));

export function dist(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Spots in a little circle around a point, so people don't spawn inside each other. */
export function around([x, y, z], i, n, radius = 2) {
    if (n <= 1) return [x, y, z];
    const a = (i / n) * Math.PI * 2;
    return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
}

/** Starts the usual 3-2-1 countdown on a fresh state. */
export function base(ctx, ids, extra = {}) {
    return {
        phase: 'countdown',
        players: [...ids],
        startAt: ctx.now + COUNTDOWN_MS,
        endsAt: null,
        scores: zeros(ids),
        winners: [],
        message: '',
        ...extra,
    };
}

/** Moves countdown → play once the clock says so. Returns true when it did. */
export function runCountdown(s, ctx, durationMs) {
    if (s.phase === 'countdown' && ctx.now >= s.startAt) {
        s.phase = 'play';
        s.endsAt = ctx.now + durationMs;
        return true;
    }
    return false;
}

/** Everyone tied for the best score. */
export function topScorers(scores, players, lowest = false) {
    if (!players.length) return [];
    const vals = players.map((p) => scores[p] ?? 0);
    const best = lowest ? Math.min(...vals) : Math.max(...vals);
    return players.filter((p) => (scores[p] ?? 0) === best);
}

export function finish(s, winners, message) {
    s.phase = 'over';
    s.winners = winners;
    s.message = message;
    s.endsAt = null;
}

/** The fields every game shows the same way. */
export const commonView = (s) => ({
    phase: s.phase,
    players: s.players,
    startAt: s.startAt,
    endsAt: s.endsAt,
    scores: s.scores,
    winners: s.winners,
    message: s.message,
});

export const validVec = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
