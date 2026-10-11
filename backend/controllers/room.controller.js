import { createRoom, findRoom, roomExists, normaliseCode } from '../services/room.service.js';
import { GAMES } from '../../shared/games.js';
import { AppError } from '../middlewares/error.middleware.js';

export const create = async (req, res) => {
    const room = createRoom();
    res.status(201).json({ success: true, data: { code: room.code } });
};

export const show = async (req, res) => {
    const code = normaliseCode(req.params.code);
    if (code.length < 3) throw new AppError('Room codes are at least 3 letters.', { code: 'invalid_code' });
    const room = findRoom(code);
    res.status(200).json({
        success: true,
        data: {
            code,
            exists: !!room || roomExists(code),
            players: room ? [...room.players.values()].map((p) => ({ name: p.name, shirt: p.shirt })) : [],
            game: room?.game?.id || null,
        },
    });
};

export const games = async (req, res) => {
    res.status(200).json({ success: true, data: GAMES });
};
