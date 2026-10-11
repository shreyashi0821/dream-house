/**
 * How Well Do You Know Me? First you answer about yourself, then you guess
 * your partner's answers, then the reveal shows who knows whom best.
 */
export default function QuizPanel({ game, me, players, send, onAgain, onClose }) {
    const nameOf = (id) => (id === me ? 'You' : players[id]?.name || 'Someone');
    const others = game.players.filter((p) => p !== me);

    if (game.phase === 'over' && game.answers) {
        return (
            <div className="pointer-events-auto fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/30 p-3">
                <div className="pop my-8 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
                    <h2 className="text-center text-2xl font-bold">The reveal 💞</h2>
                    <p className="text-center text-slate-500">{game.message}</p>
                    <div className="mt-3 flex justify-center gap-2">
                        <button type="button" className="mc-btn" onClick={onAgain}>
                            New questions
                        </button>
                        <button type="button" className="mc-btn-ghost" onClick={onClose}>
                            Back to the house
                        </button>
                    </div>
                    {game.players.map((p) => {
                        const t = game.targets[p];
                        return (
                            <div key={p} className="mt-5">
                                <div className="mb-2 font-bold">
                                    {nameOf(p)} guessed {t === me ? 'your' : `${nameOf(t)}'s`} answers — {game.scores[p]}/{game.count}
                                </div>
                                <div className="space-y-1.5">
                                    {game.questions.map((q, i) => {
                                        const real = game.answers[t][i];
                                        const g = game.guesses[p][i];
                                        const ok = real === g;
                                        return (
                                            <div key={i} className={`rounded-xl px-3 py-2 text-sm ${ok ? 'bg-green-50' : 'bg-rose-50'}`}>
                                                <div className="font-semibold">
                                                    {nameOf(t)}: “{q.q}”
                                                </div>
                                                <div>
                                                    {ok ? '✅' : '❌'} Guessed <b>{q.o[g]}</b>
                                                    {!ok && (
                                                        <>
                                                            {' '}
                                                            · really <b>{q.o[real]}</b>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (game.phase === 'over') return null;

    const answering = game.phase === 'answer';
    const done = game.mine.every((v) => v !== null);

    return (
        <div className="pointer-events-auto fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/30 p-3">
            <div className="pop my-8 w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
                <div className="text-center">
                    <div className="text-sm font-semibold uppercase tracking-wide text-love-500">{answering ? 'Step 1 of 2' : 'Step 2 of 2'}</div>
                    <h2 className="text-2xl font-bold">{answering ? 'Answer about yourself' : `Guess ${game.targetName}'s answers`}</h2>
                    <p className="text-slate-500">{answering ? 'Be honest — your partner will try to guess these!' : 'What would they pick? 🤔'}</p>
                </div>
                <div className="mt-5 space-y-4">
                    {game.questions.map((q, i) => (
                        <div key={i}>
                            <div className="mb-2 font-semibold">
                                {i + 1}. {answering ? q.q : `${game.targetName} says: “${q.q}”`}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {q.o.map((o, k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => send({ type: answering ? 'answer' : 'guess', q: i, o: k })}
                                        className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition ${
                                            game.mine[i] === k ? 'border-love-500 bg-love-50 text-love-700' : 'border-slate-100 hover:border-love-200'
                                        }`}
                                    >
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-5 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                    {done ? '✨ All done! ' : ''}
                    {others.map((p) => (
                        <span key={p} className="mx-2">
                            {nameOf(p)}: {game.progress[p] ?? 0}/{game.count}
                        </span>
                    ))}
                    {done && <div className="mt-1 text-slate-500">Waiting for your partner…</div>}
                </div>
            </div>
        </div>
    );
}
