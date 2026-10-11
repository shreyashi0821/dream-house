const EMOTES = [
    { kind: 'hearts', emoji: '💖', label: 'Hearts (H)' },
    { kind: 'kiss', emoji: '😘', label: 'Kiss' },
    { kind: 'wave', emoji: '👋', label: 'Wave' },
    { kind: 'laugh', emoji: '😂', label: 'Laugh' },
    { kind: 'dance', emoji: '💃', label: 'Dance' },
];

export default function EmoteBar({ onEmote }) {
    return (
        <div className="pointer-events-auto flex gap-1 rounded-2xl bg-black/35 p-1 backdrop-blur-sm">
            {EMOTES.map((e) => (
                <button
                    key={e.kind}
                    type="button"
                    title={e.label}
                    onClick={() => onEmote(e.kind)}
                    className="grid h-10 w-10 place-items-center rounded-xl text-xl transition hover:scale-125 hover:bg-white/15 active:scale-95"
                >
                    {e.emoji}
                </button>
            ))}
        </div>
    );
}
