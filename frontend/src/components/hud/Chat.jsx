import { useEffect, useRef, useState } from 'react';

/** Chat in the corner. Messages fade after a while unless the box is open. */
export default function Chat({ messages, open, onSend, onClose, me }) {
    const [text, setText] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const input = useRef(null);
    const list = useRef(null);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        if (open) setTimeout(() => input.current?.focus(), 0);
    }, [open]);
    useEffect(() => {
        list.current?.scrollTo({ top: list.current.scrollHeight });
    }, [messages, open]);

    const shown = open ? messages.slice(-40) : messages.filter((m) => now - m.at < 12_000).slice(-6);

    return (
        <div className="pointer-events-auto w-[min(380px,calc(100vw-2rem))]">
            <div ref={list} className={`space-y-1 overflow-y-auto ${open ? 'max-h-64 rounded-xl bg-black/40 p-2 backdrop-blur-sm' : 'max-h-48'}`}>
                {shown.map((m) => (
                    <div key={m.id} className="w-fit max-w-full rounded-lg bg-black/40 px-2.5 py-1 text-sm text-white backdrop-blur-sm">
                        {m.system ? (
                            <span className="italic text-yellow-200">{m.text}</span>
                        ) : (
                            <>
                                <span className="font-bold" style={{ color: m.color }}>
                                    {m.from === me ? 'You' : m.name}
                                </span>
                                <span className="text-white/90">: {m.text}</span>
                            </>
                        )}
                    </div>
                ))}
            </div>
            {open && (
                <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (text.trim()) onSend(text);
                        setText('');
                        onClose();
                    }}
                >
                    <input
                        ref={input}
                        value={text}
                        maxLength={200}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && onClose()}
                        placeholder="Say something sweet… 💌"
                        className="min-w-0 flex-1 rounded-xl border-2 border-white/30 bg-black/50 px-3 py-2 text-white outline-none placeholder:text-white/50 focus:border-love-300"
                    />
                    <button type="submit" className="mc-btn">
                        Send
                    </button>
                </form>
            )}
        </div>
    );
}
