import { G } from '../../shared/world.js';
import { base, finish, commonView } from './helpers.js';

/** Giant Tic-Tac-Toe on the garden board. First to three rounds. */

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const WIN_ROUNDS = 3;
const ROUND_GAP = 2500;

const winLine = (b) => LINES.find(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d]) || null;

export default {
    create(ctx, ids) {
        const [x, o] = ids;
        // From this side the board reads the same way as the little grid on screen.
        ctx.teleport(x, [79.5, G + 1, 112.5], 0);
        ctx.teleport(o, [81.5, G + 1, 112.5], 0);
        const s = base(ctx, ids, {
            seats: { [x]: 'X', [o]: 'O' },
            board: Array(9).fill(null),
            turn: x,
            starter: x,
            round: 1,
            line: null,
            nextRoundAt: null,
        });
        s.phase = 'play';
        return s;
    },

    action(s, ctx, pid, a) {
        if (a.type !== 'move' || s.phase !== 'play' || s.nextRoundAt || pid !== s.turn) return false;
        const cell = Number(a.cell);
        if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell]) return false;
        s.board[cell] = s.seats[pid];
        const line = winLine(s.board);
        if (line) {
            s.line = line;
            s.scores[pid] += 1;
            ctx.event({ type: 'roundWin', by: pid });
            if (s.scores[pid] >= WIN_ROUNDS) finish(s, [pid], `${ctx.name(pid)} wins Tic-Tac-Toe! ⭕❌`);
            else {
                s.message = `${ctx.name(pid)} takes round ${s.round}!`;
                s.nextRoundAt = ctx.now + ROUND_GAP;
            }
        } else if (s.board.every(Boolean)) {
            s.message = "It's a draw!";
            s.nextRoundAt = ctx.now + ROUND_GAP;
        } else {
            s.turn = this.other(s, pid);
        }
        return true;
    },

    other(s, pid) {
        return Object.keys(s.seats).find((p) => p !== pid && s.players.includes(p)) || pid;
    },

    tick(s, ctx) {
        if (s.phase !== 'play' || !s.nextRoundAt || ctx.now < s.nextRoundAt) return false;
        s.board = Array(9).fill(null);
        s.line = null;
        s.message = '';
        s.round += 1;
        s.starter = this.other(s, s.starter);
        s.turn = s.starter;
        s.nextRoundAt = null;
        return true;
    },

    leave(s) {
        if (s.phase !== 'over') finish(s, s.players, 'Your partner left the game.');
    },

    view(s, pid) {
        const mine = s.seats[pid];
        return {
            ...commonView(s),
            board: s.board,
            turn: s.turn,
            seats: s.seats,
            line: s.line,
            round: s.round,
            scoreLabel: 'rounds',
            hint:
                s.phase !== 'play' ? '' : !mine ? 'Watching the match 👀' : s.nextRoundAt ? s.message : s.turn === pid ? `Your turn — you are ${mine}. Click a square on the board!` : 'Waiting for your partner…',
        };
    },
};
