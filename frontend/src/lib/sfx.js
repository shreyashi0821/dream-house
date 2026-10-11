/** Tiny synthesized sounds, so there are no audio files to load. */
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('dc-muted') === '1'; } catch { /* private mode */ }

const ac = () => {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
};

function tone(freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (muted) return;
    const a = ac();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function noise(dur = 0.08, vol = 0.08) {
    if (muted) return;
    const a = ac();
    if (!a) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(a.destination);
    src.start();
}

export const sfx = {
    break: () => noise(0.09, 0.1),
    place: () => tone(220, 0.06, 'square', 0.04),
    jump: () => tone(300, 0.08, 'sine', 0.03, 120),
    coin: () => { tone(988, 0.07, 'square', 0.05); tone(1319, 0.12, 'square', 0.05, 0, 0.07); },
    heart: () => { tone(660, 0.1, 'sine', 0.06); tone(880, 0.16, 'sine', 0.06, 0, 0.1); },
    hit: () => { noise(0.06, 0.12); tone(160, 0.12, 'sawtooth', 0.04, -80); },
    throw: () => tone(500, 0.08, 'triangle', 0.04, -300),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, 0, i * 0.15)),
    tick: () => tone(880, 0.05, 'square', 0.03),
    go: () => tone(1175, 0.25, 'square', 0.05),
    pop: () => tone(700, 0.05, 'sine', 0.05, 200),
    splash: () => noise(0.3, 0.08),
    chat: () => tone(1046, 0.06, 'sine', 0.03),
    unlock: () => ac(),
    isMuted: () => muted,
    setMuted(v) {
        muted = v;
        try { localStorage.setItem('dc-muted', v ? '1' : '0'); } catch { /* ignore */ }
    },
};
