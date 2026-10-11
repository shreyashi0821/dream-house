/* Must be first: it loads .env before any other module body reads process.env. */
import './config/env.js';
import { checkEnv, allowedOrigins } from './config/env.js';

import express from 'express';
import http from 'http';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import roomRoutes from './routes/room.routes.js';
import { registerSockets } from './sockets/index.js';
import { bindIo } from './services/game.service.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';

checkEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5050;
const origin = allowedOrigins();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin }));
app.use(express.json({ limit: '100kb' }));

/* ── Routes ───────────────────────────────────────────────────────── */

app.get('/health', (req, res) => res.json({ success: true, message: 'Dream Craft is running 💖' }));
app.use('/rooms', apiLimiter, roomRoutes);

/* In production the built frontend is served from here too, so one deploy
   (and one link to send your partner) is all it takes. */
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
    app.use(express.static(DIST, { maxAge: '1h', index: false }));
    app.get(/^\/(?!rooms|health|socket\.io).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

/* ── Realtime ─────────────────────────────────────────────────────── */

const io = new Server(server, {
    cors: { origin },
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 1e6,
});
bindIo(io);
registerSockets(io);

server.listen(PORT, () => {
    console.log(`💖 Dream Craft server on http://localhost:${PORT}`);
});
