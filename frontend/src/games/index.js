import tag from './tag';
import hideSeek from './hideSeek';
import coinRush from './coinRush';
import snowball from './snowball';
import parkour from './parkour';
import spleef from './spleef';
import tictactoe from './tictactoe';
import memory from './memory';

/**
 * The in-world half of each mini-game (badges, coins, snowballs, cards).
 * Draw & Guess and the quiz live entirely in React panels, so they only say
 * that flying and building are fine while they run.
 *
 * Each module may define: enter, update, tick, event, exit, primary, secondary,
 * plus `noBuild` (no breaking/placing) and `allowFly`.
 */
export default {
    tag,
    hideSeek,
    coinRush,
    snowball,
    parkour,
    spleef,
    tictactoe,
    memory,
    drawGuess: { allowFly: true },
    coupleQuiz: { allowFly: true },
};
