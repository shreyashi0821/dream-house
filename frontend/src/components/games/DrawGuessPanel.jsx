import { useEffect, useRef, useState } from 'react';
import { Eraser, Trash2, Send } from 'lucide-react';
import useServerNow from './useServerNow';
import { sfx } from '@/lib/sfx';

const COLOURS = ['#222222', '#ff4d8d', '#ff8a3d', '#ffd23f', '#3ccf6e', '#3d8be0', '#8a5cf6', '#8b5a2b', '#ffffff'];
const SIZES = [3, 7, 14, 26];
const W = 800, H = 560;

function drawStroke(g, s) {
    g.strokeStyle = s.c;
    g.fillStyle = s.c;
    g.lineWidth = s.s;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (s.p.length === 1) {
        g.beginPath();
        g.arc(s.p[0][0] * W, s.p[0][1] * H, s.s / 2, 0, Math.PI * 2);
        g.fill();
        return;
    }
    g.beginPath();
    g.moveTo(s.p[0][0] * W, s.p[0][1] * H);
    for (const [x, y] of s.p.slice(1)) g.lineTo(x * W, y * H);
    g.stroke();
}

/**
 * Draw & Guess. The artist's lines are drawn locally straight away and sent
 * in short segments; everyone else draws each segment as it arrives.
 */
export default function DrawGuessPanel({ game, me, players, offset, send }) {
    const canvas = useRef(null);
    const pending = useRef(null);
    const [colour, setColour] = useState(COLOURS[0]);
    const [size, setSize] = useState(SIZES[1]);
    const [guess, setGuess] = useState('');
    const [feed, setFeed] = useState([]);
    const now = useServerNow(offset);
    const drawer = game.drawer === me;
    const guessed = game.guessed.includes(me);
    const nameOf = (id) => (id === me ? 'You' : players[id]?.name || 'Someone');

    // Redraw from the server's copy whenever the round or the drawing changes.
    useEffect(() => {
        const g = canvas.current.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        for (const s of game.strokes) drawStroke(g, s);
    }, [game.strokes, game.round]);

    useEffect(() => setFeed([]), [game.round]);

    useEffect(() => {
        const onEvent = (e) => {
            const ev = e.detail;
            if (ev.type === 'stroke' && !drawer) drawStroke(canvas.current.getContext('2d'), ev.stroke);
            if (ev.type === 'guess') {
                if (ev.correct) sfx.coin();
                setFeed((f) => [...f.slice(-30), { id: `${Date.now()}-${Math.random()}`, ...ev }]);
            }
        };
        window.addEventListener('dc:game-event', onEvent);
        return () => window.removeEventListener('dc:game-event', onEvent);
    }, [drawer]);

    const point = (e) => {
        const r = canvas.current.getBoundingClientRect();
        return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    };
    const flush = (keepLast) => {
        const p = pending.current;
        if (!p || !p.p.length) return;
        send({ type: 'stroke', c: p.c, s: p.s, p: p.p });
        pending.current = keepLast ? { ...p, p: [p.p[p.p.length - 1]] } : null;
    };
    const down = (e) => {
        if (!drawer || game.phase !== 'draw') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const pt = point(e);
        pending.current = { c: colour, s: size, p: [pt], last: Date.now() };
        drawStroke(canvas.current.getContext('2d'), { c: colour, s: size, p: [pt] });
    };
    const move = (e) => {
        const p = pending.current;
        if (!p) return;
        const pt = point(e);
        const prev = p.p[p.p.length - 1];
        drawStroke(canvas.current.getContext('2d'), { c: p.c, s: p.s, p: [prev, pt] });
        p.p.push(pt);
        if (p.p.length > 40 || Date.now() - p.last > 90) {
            p.last = Date.now();
            flush(true);
        }
    };
    const up = () => flush(false);

    return (
        <div className="pointer-events-auto fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/30 p-3">
            <div className="pop flex w-full max-w-5xl flex-col gap-3 rounded-3xl bg-white p-4 shadow-2xl lg:flex-row">
                <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-500">
                            Round {game.round}/{game.rounds} · {nameOf(game.drawer)} {drawer ? 'are' : 'is'} drawing
                        </div>
                        <div className="pixel rounded-lg bg-love-50 px-2 py-1 text-xs text-love-600">
                            {Math.max(0, Math.ceil(((game.endsAt || now) - now) / 1000))}s
                        </div>
                    </div>
                    <div className="mb-2 text-center text-2xl font-bold tracking-widest">
                        {game.word ? (drawer && game.phase === 'draw' ? `Draw: ${game.word}` : game.word) : <span className="font-mono">{game.mask}</span>}
                    </div>
                    <canvas
                        ref={canvas}
                        width={W}
                        height={H}
                        onPointerDown={down}
                        onPointerMove={move}
                        onPointerUp={up}
                        onPointerCancel={up}
                        className={`mx-auto block aspect-[10/7] w-full max-w-[calc(58vh*10/7)] touch-none rounded-2xl border-4 border-slate-100 ${drawer ? 'cursor-crosshair' : 'cursor-default'}`}
                    />
                    {drawer && game.phase === 'draw' && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {COLOURS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColour(c)}
                                    className={`h-8 w-8 rounded-full border-2 ${colour === c ? 'scale-110 border-slate-800' : 'border-slate-200'}`}
                                    style={{ background: c }}
                                    aria-label={c === '#ffffff' ? 'Eraser' : `Colour ${c}`}
                                >
                                    {c === '#ffffff' && <Eraser size={14} className="mx-auto text-slate-500" />}
                                </button>
                            ))}
                            <div className="mx-2 h-6 w-px bg-slate-200" />
                            {SIZES.map((s) => (
                                <button key={s} type="button" onClick={() => setSize(s)} className={`grid h-9 w-9 place-items-center rounded-lg ${size === s ? 'bg-love-100' : 'hover:bg-slate-100'}`}>
                                    <span className="rounded-full bg-slate-800" style={{ width: Math.min(22, s), height: Math.min(22, s) }} />
                                </button>
                            ))}
                            <button type="button" onClick={() => send({ type: 'clear' })} className="mc-btn-ghost ml-auto text-sm">
                                <Trash2 size={16} /> Clear
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex w-full flex-col lg:w-72">
                    <div className="mb-2 space-y-1">
                        {game.players.map((id) => (
                            <div key={id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-1.5 text-sm">
                                <span className="font-semibold">
                                    {id === game.drawer ? '🎨 ' : game.guessed.includes(id) ? '✅ ' : ''}
                                    {nameOf(id)}
                                </span>
                                <b>{game.scores[id] ?? 0}</b>
                            </div>
                        ))}
                    </div>
                    <div className="min-h-32 flex-1 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2 text-sm lg:max-h-80">
                        {feed.map((f) => (
                            <div key={f.id} className={f.correct ? 'font-semibold text-green-600' : ''}>
                                {f.correct ? `🎉 ${nameOf(f.from)} guessed it!` : `${nameOf(f.from)}: ${f.text}${f.close ? ' (so close!)' : ''}`}
                            </div>
                        ))}
                        {game.phase === 'reveal' && <div className="font-semibold text-love-600">{game.message}</div>}
                    </div>
                    {!drawer && game.phase === 'draw' && (
                        <form
                            className="mt-2 flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (guess.trim()) send({ type: 'guess', text: guess });
                                setGuess('');
                            }}
                        >
                            <input
                                value={guess}
                                disabled={guessed}
                                onChange={(e) => setGuess(e.target.value)}
                                placeholder={guessed ? 'You got it! 🎉' : 'Type your guess…'}
                                className="min-w-0 flex-1 rounded-xl border-2 border-love-100 px-3 py-2 outline-none focus:border-love-400"
                                autoFocus
                            />
                            <button type="submit" className="mc-btn" disabled={guessed}>
                                <Send size={16} />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
