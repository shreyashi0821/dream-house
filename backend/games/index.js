import tag from './tag.js';
import hideSeek from './hideSeek.js';
import coinRush from './coinRush.js';
import snowball from './snowball.js';
import parkour from './parkour.js';
import spleef from './spleef.js';
import tictactoe from './tictactoe.js';
import memory from './memory.js';
import drawGuess from './drawGuess.js';
import coupleQuiz from './coupleQuiz.js';

/**
 * Rules for every mini-game, keyed by the ids in shared/games.js.
 *
 * Each one exports:
 *   create(ctx, playerIds)          → fresh state (teleports people into place)
 *   action(state, ctx, pid, action) → true when everyone should get a new view
 *   tick(state, ctx)                → same, called ten times a second
 *   leave(state, ctx, pid)          → someone left mid-game
 *   view(state, pid, ctx)           → what that one player is allowed to see
 *   canEdit(state, pid, x, y, z, id) (optional) → may this block change now
 */
export default { tag, hideSeek, coinRush, snowball, parkour, spleef, tictactoe, memory, drawGuess, coupleQuiz };
