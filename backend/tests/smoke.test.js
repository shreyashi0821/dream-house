import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

/* Boots the real server and plays a little of every game with two clients. */

const PORT = 5099;
const URL = `http://localhost:${PORT}`;
let server;

before(async () => {
    server = spawn(process.execPath, ['index.js'], { env: { ...process.env, PORT, DATA_DIR: '/tmp/dreamcraft-test' }, stdio: 'pipe' });
    await new Promise((resolve) => server.stdout.on('data', (d) => String(d).includes('server on') && resolve()));
});
after(() => server.kill());

const connect = () => io(URL, { transports: ['websocket'] });
const emit = (s, ev, data) => new Promise((r) => s.emit(ev, data, r));
const next = (s, ev, pred = () => true) =>
    new Promise((resolve) => {
        const h = (d) => { if (pred(d)) { s.off(ev, h); resolve(d); } };
        s.on(ev, h);
    });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('rooms, blocks and every game', async () => {
    const res = await fetch(`${URL}/rooms`, { method: 'POST' }).then((r) => r.json());
    assert.equal(res.success, true);
    const code = res.data.code;

    const a = connect(), b = connect();
    const ja = await emit(a, 'room:join', { code, pid: 'player-aaaa', profile: { name: 'Shiva' } });
    const jb = await emit(b, 'room:join', { code, pid: 'player-bbbb', profile: { name: 'Shreya' } });
    assert.equal(ja.ok, true);
    assert.equal(jb.players.length, 2);

    const set = next(b, 'world:set');
    a.emit('world:set', { x: 112, y: 21, z: 80, id: 9 });
    assert.equal((await set).id, 9);

    const info = await fetch(`${URL}/rooms/${code}`).then((r) => r.json());
    assert.equal(info.data.players.length, 2);

    for (const id of ['tag', 'hideSeek', 'coinRush', 'snowball', 'parkour', 'spleef', 'tictactoe', 'memory', 'drawGuess', 'coupleQuiz']) {
        const state = next(a, 'game:state', (s) => s?.id === id);
        const r = await emit(a, 'game:start', { id });
        assert.equal(r.ok, true, `${id}: ${r.message}`);
        const s = await state;
        assert.equal(s.id, id);
    }

    // Quiz: both answer and guess everything → reveal
    await emit(a, 'game:start', { id: 'coupleQuiz' });
    for (const s of [a, b]) for (let q = 0; q < 6; q++) s.emit('game:action', { type: 'answer', q, o: q % 4 });
    await wait(200);
    const over = next(a, 'game:state', (s) => s?.phase === 'over');
    for (const s of [a, b]) for (let q = 0; q < 6; q++) s.emit('game:action', { type: 'guess', q, o: q % 4 });
    const done = await over;
    assert.equal(done.scores['player-aaaa'], 6);
    assert.ok(done.answers);

    // Tic-tac-toe: X wins the top row
    const ttt = next(a, 'game:state', (s) => s?.id === 'tictactoe');
    await emit(a, 'game:start', { id: 'tictactoe' });
    const t = await ttt;
    const xs = Object.keys(t.seats).find((p) => t.seats[p] === 'X');
    const [px, po] = xs === 'player-aaaa' ? [a, b] : [b, a];
    const won = next(a, 'game:state', (s) => s?.line);
    for (const [s, c] of [[px, 0], [po, 3], [px, 1], [po, 4], [px, 2]]) { s.emit('game:action', { type: 'move', cell: c }); await wait(30); }
    assert.deepEqual((await won).line, [0, 1, 2]);

    // Vehicles: walk up, drive, passenger, and games kick everyone out
    const closed = next(a, 'game:state', (g) => g === null);
    a.emit('game:close');
    await closed;
    assert.equal(ja.vehicles.length, 4);
    const jeep = ja.vehicles.find((v) => v.id === 'jeep-orange');
    a.emit('player:move', { p: [jeep.pos[0] + 2, jeep.pos[1], jeep.pos[2]], r: 0 });
    b.emit('player:move', { p: [jeep.pos[0] - 2, jeep.pos[1], jeep.pos[2]], r: 0 });
    await wait(50);
    assert.equal((await emit(a, 'vehicle:enter', { id: 'jeep-orange' })).seat, 'driver');
    assert.equal((await emit(b, 'vehicle:enter', { id: 'jeep-orange' })).seat, 'passenger');
    const moved = next(b, 'vehicle:moved');
    a.emit('vehicle:move', { id: 'jeep-orange', p: [120, 21, 85], r: 1, s: 12, st: 0, t: [0, 0] });
    assert.deepEqual((await moved).p, [120, 21, 85]);
    const ejected = next(a, 'vehicle:update', (v) => v.id === 'jeep-orange' && !v.driver && !v.passenger);
    await emit(a, 'game:start', { id: 'memory' });
    await ejected;
    assert.equal((await emit(a, 'vehicle:enter', { id: 'jeep-orange' })).ok, false, 'no driving mid-game');

    a.close();
    b.close();
});
