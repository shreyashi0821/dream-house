import { X } from 'lucide-react';
import { GAMES } from '@shared/games.js';

/** Pick one of the ten games. Starting one brings everyone in the world along. */
export default function GameMenu({ current, playerCount, onStart, onEnd, onClose }) {
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="pop max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Let's play 🎮</h2>
                        <p className="text-sm text-slate-500">Everyone in this world joins the game you pick.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Close">
                        <X />
                    </button>
                </div>
                {current && (
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-love-50 p-3">
                        <span className="font-semibold">
                            Playing now: {current.emoji} {current.name}
                        </span>
                        <button type="button" className="mc-btn-ghost text-sm" onClick={onEnd}>
                            End game
                        </button>
                    </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {GAMES.map((g) => {
                        const short = playerCount < g.min;
                        return (
                            <button
                                key={g.id}
                                type="button"
                                onClick={() => onStart(g.id)}
                                className="group flex items-start gap-3 rounded-2xl border-2 border-slate-100 p-3 text-left transition hover:-translate-y-0.5 hover:border-love-300 hover:shadow-lg"
                            >
                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-love-50 text-2xl transition group-hover:scale-110">{g.emoji}</div>
                                <div className="min-w-0">
                                    <div className="font-bold">{g.name}</div>
                                    <div className="text-sm text-slate-500">{g.desc}</div>
                                    {short && <div className="mt-1 text-xs font-semibold text-love-600">Needs {g.min} players — invite your partner 💌</div>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
