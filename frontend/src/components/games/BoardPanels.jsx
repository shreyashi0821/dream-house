/** Small clickable copies of the in-world boards — handy on phones. */

export function TicTacToePanel({ game, me, send }) {
    const mine = game.seats?.[me];
    return (
        <div className="pointer-events-auto glass p-2">
            <div className="mb-1 text-center text-xs text-white/80">{mine ? `You are ${mine}` : 'Watching'}</div>
            <div className="grid grid-cols-3 gap-1">
                {game.board.map((c, i) => (
                    <button
                        key={i}
                        type="button"
                        disabled={!!c || game.turn !== me || game.phase !== 'play'}
                        onClick={() => send({ type: 'move', cell: i })}
                        className={`grid h-11 w-11 place-items-center rounded-lg text-2xl font-black transition ${
                            game.line?.includes(i) ? 'bg-yellow-300/80' : 'bg-white/15 hover:bg-white/30'
                        } ${c === 'X' ? 'text-love-400' : 'text-sky-300'}`}
                    >
                        {c === 'X' ? '✕' : c === 'O' ? '◯' : ''}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function MemoryPanel({ game, me, players, send }) {
    const myTurn = game.turn === me;
    return (
        <div className="pointer-events-auto glass p-2">
            <div className="mb-1 text-center text-xs text-white/80">{myTurn ? 'Your turn' : `${players[game.turn]?.name || 'Partner'}'s turn`}</div>
            <div className="grid grid-cols-4 gap-1">
                {game.cards.map((c, i) => (
                    <button
                        key={i}
                        type="button"
                        disabled={!myTurn || !!c.e}
                        onClick={() => send({ type: 'flip', i })}
                        className="grid h-10 w-10 place-items-center rounded-lg text-xl transition"
                        style={{ background: c.by ? players[c.by]?.shirt || '#ff94bb' : c.e ? '#ffb3cf' : 'rgba(138,92,246,0.85)' }}
                    >
                        {c.e || <span className="text-sm font-bold text-white/80">?</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}
