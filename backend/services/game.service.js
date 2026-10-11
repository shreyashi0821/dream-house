import GAME_RULES from '../games/index.js';
import { GAME_BY_ID } from '../../shared/games.js';
import { setBlock, isAirAt, isSolidAt, findSpots } from './world.service.js';
import { allRooms } from './room.service.js';
import { idx } from '../../shared/world.js';

/**
 * Runs the mini-games. The server owns every game's state and the rules in
 * backend/games decide what an action does, so nobody wins by editing the
 * page. Each player is sent their own view, which is how Draw & Guess hides
 * the word and the quiz hides answers until the reveal.
 */

let io = null;
export const bindIo = (server) => {
    io = server;
};

export class GameError extends Error {}

/** What a game's rules can do to the world around them. */
function contextFor(room) {
    return {
        now: Date.now(),
        room,
        player: (pid) => room.players.get(pid),
        name: (pid) => room.players.get(pid)?.name || 'Someone',
        teleport(pid, pos, yaw) {
            const p = room.players.get(pid);
            if (!p) return;
            p.pos = [...pos];
            io.to(p.socketId).emit('teleport', { pos, yaw });
        },
        event(payload) {
            io.to(room.code).emit('game:event', payload);
        },
        setBlocks(list) {
            const changed = [];
            for (const [x, y, z, id] of list) if (setBlock(room, x, y, z, id)) changed.push(idx(x, y, z), id);
            if (changed.length) io.to(room.code).emit('world:bulk', { edits: changed });
        },
        isAir: (x, y, z) => isAirAt(room, x, y, z),
        isSolid: (x, y, z) => isSolidAt(room, x, y, z),
        findSpots: (n, area) => findSpots(room, n, area),
    };
}

function viewFor(room, pid) {
    const g = room.game;
    if (!g) return null;
    const rules = GAME_RULES[g.id];
    const meta = GAME_BY_ID[g.id];
    return {
        ...rules.view(g.state, pid, contextFor(room)),
        id: g.id,
        name: meta.name,
        emoji: meta.emoji,
        startedBy: g.startedBy,
        now: Date.now(),
    };
}

export function broadcast(room) {
    for (const p of room.players.values()) io.to(p.socketId).emit('game:state', viewFor(room, p.id));
}

export const currentView = (room, pid) => viewFor(room, pid);

export function startGame(room, gameId, pid) {
    const rules = GAME_RULES[gameId];
    const meta = GAME_BY_ID[gameId];
    if (!rules || !meta) throw new GameError('That game does not exist.');
    if (room.players.size < meta.min) throw new GameError(`${meta.name} needs ${meta.min} players — invite your partner first 💌`);
    if (room.game) endGame(room);
    const ids = [...room.players.keys()];
    const state = rules.create(contextFor(room), ids);
    room.game = { id: gameId, state, startedBy: pid };
    broadcast(room);
}

export function gameAction(room, pid, action) {
    const g = room.game;
    if (!g || !action || typeof action !== 'object' || typeof action.type !== 'string') return;
    if (!g.state.players.includes(pid)) return;
    const changed = GAME_RULES[g.id].action(g.state, contextFor(room), pid, action);
    if (changed) broadcast(room);
}

export function endGame(room) {
    const g = room.game;
    if (!g) return;
    GAME_RULES[g.id].cleanup?.(g.state, contextFor(room));
    room.game = null;
    io.to(room.code).emit('game:state', null);
}

export function playerLeft(room, pid) {
    const g = room.game;
    if (!g || !g.state.players.includes(pid)) return;
    const rules = GAME_RULES[g.id];
    g.state.players = g.state.players.filter((p) => p !== pid);
    rules.leave?.(g.state, contextFor(room), pid);
    if (g.state.players.length === 0) endGame(room);
    else broadcast(room);
}

/** Whether a block change is allowed right now (Spleef guards its arena). */
export function canEdit(room, pid, x, y, z, id) {
    const g = room.game;
    if (!g) return true;
    const rules = GAME_RULES[g.id];
    return rules.canEdit ? rules.canEdit(g.state, pid, x, y, z, id, contextFor(room)) : true;
}

/* One clock for every running game: countdowns, timers and turn changes. */
setInterval(() => {
    for (const room of allRooms()) {
        const g = room.game;
        if (!g || g.state.phase === 'over') continue;
        const rules = GAME_RULES[g.id];
        try {
            if (rules.tick?.(g.state, contextFor(room))) broadcast(room);
        } catch (err) {
            console.error(`[game:${g.id}] tick failed`, err);
        }
    }
}, 100).unref();
