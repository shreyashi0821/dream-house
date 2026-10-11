/**
 * The ten mini-games, as the lobby and the game menu show them.
 * The rules themselves live in backend/games/<id>.js.
 */
export const GAMES = [
    { id: 'tag', name: 'Pakdam Pakdai', emoji: '🏃', min: 2, desc: 'Classic tag. Whoever is "it" has to catch the other. Least time as "it" wins.' },
    { id: 'hideSeek', name: 'Hide & Seek', emoji: '🙈', min: 2, desc: 'One counts with eyes closed, the rest hide anywhere in the dream house.' },
    { id: 'coinRush', name: 'Coin Rush', emoji: '🪙', min: 1, desc: 'Coins and hearts are scattered around the house. Grab more than your partner.' },
    { id: 'snowball', name: 'Snowball Fight', emoji: '❄️', min: 2, desc: 'Throw snowballs at each other. First to 10 hits wins.' },
    { id: 'parkour', name: 'Sky Parkour', emoji: '🧗', min: 1, desc: 'Race across floating blocks in the sky. Gold blocks save your progress.' },
    { id: 'spleef', name: 'Spleef', emoji: '⛏️', min: 1, desc: 'Break the snow under your partner\'s feet. Last one standing wins.' },
    { id: 'tictactoe', name: 'Giant Tic-Tac-Toe', emoji: '⭕', min: 2, desc: 'Tic-tac-toe on a giant board in the garden. First to 3 rounds.' },
    { id: 'memory', name: 'Memory Match', emoji: '🃏', min: 1, desc: 'Flip giant cards and find the pairs. Find a pair and you go again.' },
    { id: 'drawGuess', name: 'Draw & Guess', emoji: '🎨', min: 2, desc: 'One draws, the other guesses. Faster guesses score more.' },
    { id: 'coupleQuiz', name: 'How Well Do You Know Me?', emoji: '💞', min: 2, desc: 'Answer questions about yourself, then guess your partner\'s answers.' },
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

/* What a player looks like. The lobby offers these, the server only accepts these. */
export const SKIN_TONES = ['#f8d5b8', '#e8b48f', '#c98e66', '#a0674a', '#6e4532'];
export const HAIR_COLOURS = ['#1d1410', '#4a2c1a', '#8a5a2b', '#d9a441', '#e05a8a', '#6b4bd6'];
export const OUTFIT_COLOURS = ['#ff4d8d', '#ff8a3d', '#ffd23f', '#3ccf6e', '#2ec4b6', '#3d8be0', '#8a5cf6', '#f4f4f4', '#2b2b33'];
export const HAIR_STYLES = ['short', 'long', 'bun'];
export const HATS = ['none', 'bow', 'cap', 'crown', 'flower'];

export const MAX_PLAYERS = 8;
