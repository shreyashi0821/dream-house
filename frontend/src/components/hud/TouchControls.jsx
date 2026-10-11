import { useRef, useState } from 'react';

/**
 * Phone controls: a joystick on the left, drag anywhere on the right to look,
 * and big buttons for jumping, breaking and placing.
 */
export default function TouchControls({ engine }) {
    const base = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const stick = useRef(null);
    const look = useRef(null);

    const onStickDown = (e) => {
        stick.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        onStickMove(e);
    };
    const onStickMove = (e) => {
        if (stick.current !== e.pointerId) return;
        const r = base.current.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(x, y);
        if (len > 1) { x /= len; y /= len; }
        setKnob({ x, y });
        engine?.setTouch({ x, y, sprint: len > 0.95 });
    };
    const onStickUp = () => {
        stick.current = null;
        setKnob({ x: 0, y: 0 });
        engine?.setTouch({ x: 0, y: 0, sprint: false });
    };

    const onLookDown = (e) => {
        look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onLookMove = (e) => {
        const l = look.current;
        if (!l || l.id !== e.pointerId) return;
        engine?.look(e.clientX - l.x, e.clientY - l.y, 0.006);
        l.x = e.clientX;
        l.y = e.clientY;
    };
    const onLookUp = () => (look.current = null);

    const hold = (on, off) => ({
        onPointerDown: (e) => { e.preventDefault(); on(); },
        onPointerUp: off,
        onPointerCancel: off,
        onPointerLeave: off,
    });

    const btn = 'grid h-16 w-16 place-items-center rounded-full bg-white/25 text-2xl text-white backdrop-blur-sm active:bg-white/45 select-none';

    return (
        <>
            <div className="pointer-events-auto absolute bottom-0 right-0 top-24 w-1/2 touch-none" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} />
            <div
                ref={base}
                className="pointer-events-auto absolute bottom-24 left-6 h-36 w-36 touch-none rounded-full bg-white/15 ring-2 ring-white/30 backdrop-blur-sm"
                onPointerDown={onStickDown}
                onPointerMove={onStickMove}
                onPointerUp={onStickUp}
                onPointerCancel={onStickUp}
            >
                <div
                    className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/70 shadow-lg"
                    style={{ transform: `translate(calc(-50% + ${knob.x * 44}px), calc(-50% + ${knob.y * 44}px))` }}
                />
            </div>
            <div className="pointer-events-auto absolute bottom-24 right-5 flex touch-none flex-col items-end gap-3">
                <div className="flex gap-3">
                    <button type="button" className={btn} {...hold(() => engine?.startRepeat(() => engine.secondary()), () => engine?.stopRepeat())}>
                        🧱
                    </button>
                    <button type="button" className={btn} {...hold(() => engine?.startRepeat(() => engine.primary()), () => engine?.stopRepeat())}>
                        ⛏️
                    </button>
                </div>
                <div className="flex gap-3">
                    <button type="button" className={btn} {...hold(() => engine?.setTouch({ down: true }), () => engine?.setTouch({ down: false }))}>
                        ⬇️
                    </button>
                    <button type="button" className={btn} {...hold(() => engine?.setTouch({ jump: true }), () => engine?.setTouch({ jump: false }))}>
                        ⬆️
                    </button>
                </div>
            </div>
        </>
    );
}
