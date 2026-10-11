import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Sparkles, DoorOpen, Heart, Play as PlayIcon } from 'lucide-react';
import AvatarPreview from '@/components/lobby/AvatarPreview';
import { selectProfile, selectLastRoom, selectCreating } from '@/store/global.Selector';
import { setProfile, enterRoom } from '@/store/global.Slice';
import { CreateRoom } from '@/store/global.Action';
import { GAMES, SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, HAIR_STYLES, HATS } from '@shared/games.js';

const HAT_LABEL = { none: '—', bow: '🎀', cap: '🧢', crown: '👑', flower: '🌸' };
const STYLE_LABEL = { short: 'Short', long: 'Long', bun: 'Bun' };

function Swatches({ label, value, options, onPick }) {
    return (
        <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="flex flex-wrap gap-1.5">
                {options.map((c) => (
                    <button
                        key={c}
                        type="button"
                        aria-label={`${label} ${c}`}
                        onClick={() => onPick(c)}
                        className={`h-7 w-7 rounded-lg border-2 transition hover:scale-110 ${value === c ? 'border-slate-800 scale-110' : 'border-white shadow'}`}
                        style={{ background: c }}
                    />
                ))}
            </div>
        </div>
    );
}

function Chips({ label, value, options, render, onPick }) {
    return (
        <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                    <button
                        key={o}
                        type="button"
                        onClick={() => onPick(o)}
                        className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${value === o ? 'bg-love-500 text-white' : 'bg-white text-slate-600 shadow hover:bg-love-50'}`}
                    >
                        {render(o)}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function Lobby() {
    const dispatch = useDispatch();
    const profile = useSelector(selectProfile);
    const lastRoom = useSelector(selectLastRoom);
    const creating = useSelector(selectCreating);
    const [code, setCode] = useState('');

    const set = (patch) => dispatch(setProfile(patch));
    const needName = () => {
        if (profile.name.trim()) return false;
        toast('Pick a name first 💕');
        document.getElementById('name')?.focus();
        return true;
    };

    const create = async () => {
        if (needName()) return;
        const res = await dispatch(CreateRoom());
        if (res.error) toast.error(res.payload || 'Could not create a world.');
    };
    const join = (c) => {
        if (needName()) return;
        const clean = c.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (clean.length < 3) return toast('Room codes are at least 3 letters.');
        dispatch(enterRoom(clean));
    };

    return (
        <div className="min-h-full overflow-y-auto bg-[radial-gradient(circle_at_20%_10%,#ffd6e7_0,transparent_40%),radial-gradient(circle_at_90%_30%,#d6ecff_0,transparent_40%),linear-gradient(#fff6fa,#fff)]">
            <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
                <header className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-love-600 shadow">
                        <Heart size={16} className="fill-love-500 text-love-500" /> Shreya's Dream House, block by block
                    </div>
                    <h1 className="pixel mt-5 text-3xl leading-tight text-slate-800 sm:text-5xl">
                        Dream <span className="text-love-500">Craft</span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
                        A cosy block world for two. Build your dream house together, wander the garden, and play 10 little games — from anywhere in the world.
                    </p>
                </header>

                <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                    {/* Character */}
                    <section className="rounded-3xl bg-white/80 p-6 shadow-xl shadow-love-100 backdrop-blur">
                        <h2 className="text-xl font-bold">Your character</h2>
                        <div className="mt-4 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                            <div className="flex justify-center rounded-2xl bg-gradient-to-b from-sky-100 to-green-100 px-6 pb-4 pt-8">
                                <AvatarPreview look={profile} size={9} />
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Name
                                    </label>
                                    <input
                                        id="name"
                                        value={profile.name}
                                        maxLength={16}
                                        onChange={(e) => set({ name: e.target.value })}
                                        placeholder="Shreya"
                                        className="w-full rounded-xl border-2 border-love-100 bg-white px-4 py-2.5 text-lg font-semibold outline-none focus:border-love-400"
                                    />
                                </div>
                                <Swatches label="Skin" value={profile.skin} options={SKIN_TONES} onPick={(skin) => set({ skin })} />
                                <Swatches label="Hair" value={profile.hair} options={HAIR_COLOURS} onPick={(hair) => set({ hair })} />
                                <Chips label="Hair style" value={profile.hairStyle} options={HAIR_STYLES} render={(o) => STYLE_LABEL[o]} onPick={(hairStyle) => set({ hairStyle })} />
                                <Swatches label="Top" value={profile.shirt} options={OUTFIT_COLOURS} onPick={(shirt) => set({ shirt })} />
                                <Swatches label="Bottoms" value={profile.pants} options={OUTFIT_COLOURS} onPick={(pants) => set({ pants })} />
                                <Chips label="Hat" value={profile.hat} options={HATS} render={(o) => HAT_LABEL[o]} onPick={(hat) => set({ hat })} />
                            </div>
                        </div>
                    </section>

                    {/* Play */}
                    <section className="flex flex-col gap-6">
                        <div className="rounded-3xl bg-white/80 p-6 shadow-xl shadow-love-100 backdrop-blur">
                            <h2 className="text-xl font-bold">Play together</h2>
                            <p className="mt-1 text-slate-500">Make a world, then send the link to your partner. Your builds are saved.</p>
                            <div className="mt-5 flex flex-col gap-3">
                                <button type="button" className="mc-btn py-3 text-lg" onClick={create} disabled={creating}>
                                    <Sparkles size={20} /> {creating ? 'Making your world…' : 'Create a new world'}
                                </button>
                                {lastRoom && (
                                    <button type="button" className="mc-btn-ghost py-3" onClick={() => join(lastRoom)}>
                                        <PlayIcon size={18} /> Continue in world <span className="pixel text-xs text-love-600">{lastRoom}</span>
                                    </button>
                                )}
                                <form
                                    className="flex gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        join(code);
                                    }}
                                >
                                    <input
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="Partner's code"
                                        maxLength={8}
                                        className="pixel min-w-0 flex-1 rounded-xl border-2 border-love-100 bg-white px-4 py-2.5 text-sm uppercase outline-none focus:border-love-400"
                                    />
                                    <button type="submit" className="mc-btn-ghost">
                                        <DoorOpen size={18} /> Join
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="rounded-3xl bg-white/80 p-6 shadow-xl shadow-love-100 backdrop-blur">
                            <h2 className="text-xl font-bold">10 games inside</h2>
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
                                {GAMES.map((g) => (
                                    <div key={g.id} className="flex items-start gap-2 rounded-2xl bg-love-50/70 p-3">
                                        <div className="text-2xl leading-none">{g.emoji}</div>
                                        <div>
                                            <div className="text-sm font-bold leading-tight">{g.name}</div>
                                            <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{g.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="mt-10 text-center text-sm text-slate-400">
                    WASD to walk · Space to jump · Click to break · Right-click to place · F to fly · Made with 💖
                </footer>
            </div>
        </div>
    );
}
