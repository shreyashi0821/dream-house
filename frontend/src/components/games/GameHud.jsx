import { useEffect, useRef } from 'react';
import { RotateCcw, X, Trophy } from 'lucide-react';
import useServerNow from './useServerNow';
import { sfx } from '@/lib/sfx';

const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The game bar at the top, the big 3-2-1, and the results card. */
export default function GameHud({ game, me, players, offset, onAgain, onClose, noResults = false }) {
    const now = useServerNow(offset);
    const nameOf = (id) => (id === me ? 'You' : players[id]?.name || 'Someone');
    const colourOf = (id) => players[id]?.shirt || '#ff4d8d';
    const countdown = game.phase === 'countdown' ? Math.ceil((game.startAt - now) / 1000) : null;
    const lastCount = useRef(null);
    const over = game.phase === 'over';
    const won = over && game.winners.includes(me);

    useEffect(() => {
        if (countdown !== lastCount.current) {
            if (countdown > 0) sfx.tick();
            else if (countdown === 0 && lastCount.current > 0) sfx.go();
            lastCount.current = countdown;
        }
    }, [countdown]);
    useEffect(() => {
        if (over) (won ? sfx.win : sfx.lose)();
    }, [over, won]);

    const ranked = [...game.players].sort((a, b) => (game.lowerIsBetter ? 1 : -1) * ((game.scores[a] ?? 0) - (game.scores[b] ?? 0)));

    return (
        <>
            {!over && (
                <div className="pointer-events-auto glass pop flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                    <div className="font-bold">
                        {game.emoji} {game.name}
                    </div>
                    {game.endsAt && <div className="pixel rounded-lg bg-white/15 px-2 py-1 text-xs">{fmt(game.endsAt - now)}</div>}
                    <div className="flex flex-wrap gap-3 text-sm">
                        {ranked.map((id) => (
                            <span key={id} className="flex items-center gap-1">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colourOf(id) }} />
                                {nameOf(id)} <b>{game.scores[id] ?? 0}</b>
                            </span>
                        ))}
                        <span className="text-white/60">{game.scoreLabel}</span>
                    </div>
                    <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10" title="End game">
                        <X size={16} />
                    </button>
                    {game.hint && <div className="w-full text-sm text-yellow-100">{game.hint}</div>}
                </div>
            )}

            {countdown > 0 && (
                <div className="pointer-events-none fixed inset-0 grid place-items-center">
                    <div key={countdown} className="pixel pop text-8xl text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
                        {countdown}
                    </div>
                </div>
            )}

            {over && !noResults && (
                <div className="pointer-events-auto fixed inset-0 z-30 grid place-items-center bg-black/35 p-4">
                    <div className="pop w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
                        <div className="text-5xl">{won ? '🏆' : game.winners.length ? '💞' : '🤝'}</div>
                        <h2 className="mt-2 text-2xl font-bold">{won ? 'You win!' : game.winners.length ? `${game.winners.map(nameOf).join(' & ')} win${game.winners.length === 1 ? 's' : ''}!` : 'Game over'}</h2>
                        <p className="mt-1 text-slate-600">{game.message}</p>
                        <div className="mt-4 space-y-1.5">
                            {ranked.map((id, i) => (
                                <div key={id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                                    <span className="flex items-center gap-2 font-semibold">
                                        {game.winners.includes(id) ? <Trophy size={16} className="text-yellow-500" /> : <span className="w-4 text-slate-400">{i + 1}</span>}
                                        <span className="h-3 w-3 rounded-full" style={{ background: colourOf(id) }} />
                                        {nameOf(id)}
                                    </span>
                                    <span className="text-slate-600">
                                        <b>{game.scores[id] ?? 0}</b> {game.scoreLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex justify-center gap-2">
                            <button type="button" className="mc-btn" onClick={onAgain}>
                                <RotateCcw size={18} /> Play again
                            </button>
                            <button type="button" className="mc-btn-ghost" onClick={onClose}>
                                Back to the house
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
