import express from 'express';
import { create, show, games } from '../controllers/room.controller.js';
import { wrap } from '../middlewares/error.middleware.js';
import { createRoomLimiter } from '../middlewares/rateLimit.middleware.js';

const router = express.Router();

router.get('/games', wrap(games));
router.post('/', createRoomLimiter, wrap(create));
router.get('/:code', wrap(show));

export default router;
