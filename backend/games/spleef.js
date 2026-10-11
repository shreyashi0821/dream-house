import { SPLEEF, G } from '../../shared/world.js';
import { SNOW, AIR } from '../../shared/blocks.js';
import { base, runCountdown, finish, commonView, around } from './helpers.js';

/** Spleef: dig the snow out from under each other. Last one standing wins. */

const DURATION = 180_000;
const CENTRE = [(SPLEEF.x0 + SPLEEF.x1 + 1) / 2, SPLEEF.y + 1, (SPLEEF.z0 + SPLEEF.z1 + 1) / 2];
const EXIT = [CENTRE[0], G + 1, SPLEEF.z0 - 3.5];

const inArena = (x, z) => x >= SPLEEF.x0 && x <= SPLEEF.x1 && z >= SPLEEF.z0 && z <= SPLEEF.z1;

function restoreSnow(ctx) {
    const list = [];
    for (let z = SPLEEF.z0; z <= SPLEEF.z1; z++) for (let x = SPLEEF.x0; x <= SPLEEF.x1; x++) list.push([x, SPLEEF.y, z, SNOW]);
    ctx.setBlocks(list);
}

export default {
    create(ctx, ids) {
        restoreSnow(ctx);
        ids.forEach((pid, i) => ctx.teleport(pid, around(CENTRE, i, ids.length, 5), 0));
        return base(ctx, ids, { alive: [...ids], out: [] });
    },

    canEdit(s, pid, x, y, z, id) {
        if (s.phase === 'over' || !inArena(x, z) || y < SPLEEF.y - 7 || y > SPLEEF.y + 4) return true;
        return s.phase === 'play' && id === AIR && y === SPLEEF.y && s.alive.includes(pid);
    },

    action(s, ctx, pid, a) {
        if (a.type !== 'fell') return false;
        return this.knockOut(s, ctx, pid);
    },

    knockOut(s, ctx, pid) {
        if (s.phase !== 'play' || !s.alive.includes(pid)) return false;
        s.alive = s.alive.filter((p) => p !== pid);
        s.out.push(pid);
        s.scores[pid] = Math.round((ctx.now - s.startAt) / 1000);
        ctx.event({ type: 'splash', who: pid });
        this.checkEnd(s, ctx);
        return true;
    },

    checkEnd(s, ctx) {
        if (s.players.length >= 2 && s.alive.length <= 1) {
            this.end(s, ctx, s.alive.length ? `${ctx.name(s.alive[0])} is the last one standing! ⛏️` : 'Everyone fell in! 💦');
        } else if (s.players.length < 2 && s.alive.length === 0) {
            this.end(s, ctx, `You lasted ${s.scores[s.players[0]]} seconds. Invite your partner for a real duel!`);
        }
    },

    end(s, ctx, message) {
        for (const p of s.alive) s.scores[p] = Math.round((ctx.now - s.startAt) / 1000);
        finish(s, [...s.alive], message);
        s.players.forEach((pid, i) => ctx.teleport(pid, around(EXIT, i, s.players.length, 1.5), Math.PI));
    },

    tick(s, ctx) {
        if (runCountdown(s, ctx, DURATION)) return true;
        if (s.phase !== 'play') return false;
        if (ctx.now - s.startAt > 1500) {
            for (const pid of s.alive) {
                const p = ctx.player(pid)?.pos;
                if (p && inArena(Math.floor(p[0]), Math.floor(p[2])) && p[1] < SPLEEF.y - 0.5) return this.knockOut(s, ctx, pid);
            }
        }
        if (ctx.now >= s.endsAt) {
            this.end(s, ctx, 'Time is up! Everyone still standing wins.');
            return true;
        }
        return false;
    },

    leave(s, ctx, pid) {
        s.alive = s.alive.filter((p) => p !== pid);
        if (s.phase === 'play') this.checkEnd(s, ctx);
    },

    view(s, pid) {
        return {
            ...commonView(s),
            alive: s.alive,
            scoreLabel: 'sec survived',
            frozenUntil: s.startAt,
            arena: SPLEEF,
            hint: s.phase === 'play' ? (s.alive.includes(pid) ? 'Click the snow to break it — make your partner fall! ⛏️' : 'You fell in 💦 Watch the rest!') : '',
        };
    },
};
