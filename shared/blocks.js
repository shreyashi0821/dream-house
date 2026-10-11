/**
 * Every block in Dream Craft, in one table both the server and the browser read.
 *
 * The id is the index, so the order is part of the save format: add new blocks
 * at the end, never in the middle, or every saved world turns into the wrong
 * blocks. Textures are painted in the browser from `tex` (a pattern name and a
 * colour), so there are no image files to ship.
 */

const B = [];
const def = (name, color, tex, opts = {}) => {
    const t = typeof tex === 'string' ? { top: tex, side: tex, bottom: tex } : tex;
    B.push({
        id: B.length,
        name,
        color,
        top: t.top,
        side: t.side,
        bottom: t.bottom ?? t.top,
        solid: opts.solid ?? true,
        transparent: opts.transparent ?? false,
        liquid: opts.liquid ?? false,
        placeable: opts.placeable ?? true,
        light: opts.light ?? false,
    });
    return B.length - 1;
};

export const AIR = def('Air', '#000000', 'none', { solid: false, transparent: true, placeable: false });
export const GRASS = def('Grass', '#6cbf4a', { top: 'grass_top', side: 'grass_side', bottom: 'dirt' });
export const DIRT = def('Dirt', '#8b5a2b', 'dirt');
export const STONE = def('Stone', '#8a8a8a', 'stone');
export const COBBLE = def('Cobblestone', '#7a7a7a', 'cobble');
export const SAND = def('Sand', '#e8d9a0', 'sand');
export const WATER = def('Water', '#3d8be0', 'water', { solid: false, transparent: true, liquid: true, placeable: false });
export const LOG = def('Oak Log', '#6b4a2a', { top: 'log_top', side: 'log_side' });
export const LEAVES = def('Leaves', '#3f9a3a', 'leaves');
export const PLANKS = def('Oak Planks', '#c09359', 'planks');
export const GLASS = def('Glass', '#cfeeff', 'glass', { transparent: true });
export const BRICK = def('Bricks', '#a5523f', 'brick');
export const QUARTZ = def('Quartz', '#f2efe9', 'quartz');
export const SNOW = def('Snow', '#fbfdff', 'snow');
export const GOLD = def('Gold Block', '#f7c843', 'gold');
export const EMERALD = def('Emerald Block', '#2fd07a', 'gold');
export const GLOW = def('Glowstone', '#ffe08a', 'glow', { light: true });
export const BEDROCK = def('Bedrock', '#3a3a3a', 'cobble', { placeable: false });
export const GRAVEL = def('Gravel', '#9a948c', 'gravel');
export const DARK_PLANKS = def('Dark Planks', '#5a3b22', 'planks');
export const BOOKSHELF = def('Bookshelf', '#c09359', { top: 'planks', side: 'books' });
export const OBSIDIAN = def('Obsidian', '#1d1830', 'stone');
export const CHERRY_LEAVES = def('Cherry Leaves', '#f6a8c8', 'leaves');
export const ROSE_BUSH = def('Rose Bush', '#3f9a3a', 'flowers_red');
export const SUN_BUSH = def('Sunflower Bush', '#3f9a3a', 'flowers_yellow');
export const DIAMOND = def('Diamond Block', '#64e3df', 'gold');
export const TNT = def('TNT', '#d8322b', { top: 'tnt_top', side: 'tnt_side' });
export const CHOCOLATE = def('Chocolate', '#5b3420', 'choc');
export const FROSTING = def('Pink Frosting', '#ff9cc4', { top: 'frost', side: 'frost_side', bottom: 'choc' });
export const PUMPKIN = def('Pumpkin', '#e38a1e', { top: 'pumpkin_top', side: 'pumpkin_side' });
export const MELON = def('Melon', '#5fae3a', { top: 'melon', side: 'melon' });
export const HAY = def('Hay Bale', '#d8b33a', { top: 'hay_top', side: 'hay_side' });
export const ICE = def('Ice', '#a9d8ff', 'ice', { transparent: true });
export const SEA_LANTERN = def('Sea Lantern', '#d7f3ef', 'glow', { light: true });

/* Sixteen wool colours, the building palette people reach for first. */
export const WOOL = {};
for (const [k, c] of Object.entries({
    white: '#f4f4f4', orange: '#f28a2d', magenta: '#c64fbd', lightBlue: '#4fb3e8',
    yellow: '#f9d43a', lime: '#7ccb2d', pink: '#f59ab8', gray: '#4a4f54',
    lightGray: '#9d9d97', cyan: '#169c9c', purple: '#8932b7', blue: '#353a9e',
    brown: '#7a4f2e', green: '#556e1c', red: '#b02e26', black: '#1b1b20',
})) {
    WOOL[k] = def(`${k[0].toUpperCase()}${k.slice(1).replace(/([A-Z])/g, ' $1')} Wool`, c, 'wool');
}

/* The dream house's own paints and floors, matched to the original 2D plan. */
export const PAINT = {};
for (const [k, c] of Object.entries({
    cream: '#fff0bf', peach: '#ffe2c9', mint: '#c9f5e6', sky: '#cdeeff', lemon: '#fff5d1',
    night: '#2e2a5c', blush: '#ffd9e4', sandstone: '#f3ead9', lavender: '#e6dbff', rose: '#ffd6ec',
    aqua: '#d0f4f7', butter: '#fff0c9', linen: '#fdf6ec', ice: '#d4e9ff', pistachio: '#dff7d2',
    seafoam: '#d9f7ef',
})) {
    PAINT[k] = def(`${k[0].toUpperCase()}${k.slice(1)} Paint`, c, 'plain');
}
export const TILE = {};
for (const [k, c] of Object.entries({ blue: '#90caf9', aqua: '#b2ebf2', teal: '#80deea', mint: '#b2dfdb' })) {
    TILE[k] = def(`${k[0].toUpperCase()}${k.slice(1)} Tiles`, c, 'tile');
}
export const CARPET = {};
for (const [k, c] of Object.entries({ galaxy: '#3b2d6b', blossom: '#f3d9e6', meadow: '#9fd8a0' })) {
    CARPET[k] = def(`${k[0].toUpperCase()}${k.slice(1)} Carpet`, c, 'carpet');
}
export const CHECKER = def('Checker Floor', '#ffcf99', 'checker');
export const WOOD_FLOOR = def('Wood Floor', '#d9a066', 'planks');
export const RED_WOOD_FLOOR = def('Walnut Floor', '#a0673f', 'planks');
export const ROAD = def('Road', '#4b4f57', 'road');
export const ROAD_LINE = def('Road Line', '#4b4f57', 'road_line');
export const POOL_TILE = def('Pool Tile', '#5ec8e8', 'tile');
export const HEART = def('Heart Block', '#ff4d8d', 'heart', { light: true });

export const BLOCKS = B;
export const BLOCK_COUNT = B.length;

export const isSolid = (id) => B[id]?.solid ?? false;
export const isTransparent = (id) => B[id]?.transparent ?? true;
export const isPlaceable = (id) => B[id]?.placeable ?? false;

/* What the hotbar starts with: enough to build a little house on day one. */
export const DEFAULT_HOTBAR = [GRASS, PLANKS, QUARTZ, GLASS, BRICK, WOOL.pink, HEART, GLOW, CHERRY_LEAVES];
