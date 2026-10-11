import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Gamepad2, Sun, Moon, Eye, Feather, Volume2, VolumeX, Home, LogOut, Link2, Boxes, MessageCircle, MapPin, Navigation } from 'lucide-react';
import { Engine } from '@/engine/Engine';
import { openSocket, closeSocket, request, playerId } from '@/lib/socket';
import { sfx } from '@/lib/sfx';
import { SPAWN } from '@shared/world.js';
import { selectProfile, selectPlayers, selectChat, selectGame, selectMe, selectConnected } from '@/store/global.Selector';
import { joined, setConnected, playerJoined, playerLeft, chatMessage, setGame, leaveRoom } from '@/store/global.Slice';
import Hotbar from '@/components/hud/Hotbar';
import Inventory from '@/components/hud/Inventory';
import Chat from '@/components/hud/Chat';
import EmoteBar from '@/components/hud/EmoteBar';
import GameMenu from '@/components/hud/GameMenu';
import TouchControls from '@/components/hud/TouchControls';
import GameHud from '@/components/games/GameHud';
import { TicTacToePanel, MemoryPanel } from '@/components/games/BoardPanels';
import DrawGuessPanel from '@/components/games/DrawGuessPanel';
import QuizPanel from '@/components/games/QuizPanel';

const IconButton = ({ title, onClick, children, active }) => (
    <button
        type="button"
        title={title}
        onClick={onClick}
        className={`grid h-10 w-10 place-items-center rounded-xl text-white backdrop-blur-sm transition hover:scale-105 ${active ? 'bg-love-500/90' : 'bg-black/40 hover:bg-black/55'}`}
    >
        {children}
    </button>
);

/** The world: the 3D canvas plus every overlay on top of it. */
export default function Play({ code }) {
    const dispatch = useDispatch();
    const profile = useSelector(selectProfile);
    const players = useSelector(selectPlayers);
    const chat = useSelector(selectChat);
    const game = useSelector(selectGame);
    const me = useSelector(selectMe);
    const connected = useSelector(selectConnected);

    const mount = useRef(null);
    const engineRef = useRef(null);
    const [engine, setEngine] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [hud, setHud] = useState({ zone: '', coords: [0, 0, 0] });
    const [bar, setBar] = useState({ hotbar: [], slot: 0 });
    const [locked, setLocked] = useState(false);
    const [panel, setPanel] = useState(null); // 'chat' | 'games' | 'inventory' | null
    const [night, setNight] = useState(false);
    const [muted, setMuted] = useState(sfx.isMuted());
    const [flash, setFlash] = useState(null);
    const [offset, setOffset] = useState(0);
    const isTouch = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches, []);

    /* ── Connect, build the world, wire every event ─────────────────── */
    useEffect(() => {
        const socket = openSocket();
        const pid = playerId();
        const ui = (type, data) => {
            if (type === 'hud') setHud(data);
            else if (type === 'hotbar') setBar(data);
            else if (type === 'lock') setLocked(data);
            else if (type === 'toast') toast(data.text, { id: data.text, duration: 2200, style: { background: '#1f1630', color: '#fff' } });
            else if (type === 'flash') {
                setFlash(data);
                setTimeout(() => setFlash(null), 250);
            }
        };
        const eng = new Engine(mount.current, { me: pid, profile, net: { send: (ev, d) => socket.emit(ev, d), request }, ui });
        eng.isTouch = isTouch;
        engineRef.current = eng;
        if (import.meta.env.DEV) Object.assign(window, { __dreamCraft: eng, __dreamCraftSocket: socket }); // handy in the console while developing
        setEngine(eng);
        let started = false;

        const join = async () => {
            const res = await request('room:join', { code, pid, profile });
            if (!res.ok) {
                setError(res.message || 'Could not join this world.');
                setStatus('error');
                return;
            }
            dispatch(joined(res));
            if (!started) {
                eng.load(res.edits);
                eng.start();
                started = true;
            } else {
                eng.applyBulk(res.edits);
                for (const id of [...eng.remotes.keys()]) eng.removePlayer(id);
            }
            res.players.forEach((p) => eng.addPlayer(p));
            eng.loadVehicles(res.vehicles);
            if (res.game) setOffset(res.game.now - Date.now());
            eng.setGame(res.game);
            setStatus('ready');
        };

        socket.on('connect', join);
        if (socket.connected) join();
        socket.on('disconnect', () => dispatch(setConnected(false)));
        socket.on('player:joined', (p) => {
            eng.addPlayer(p);
            dispatch(playerJoined(p));
            sfx.heart();
        });
        socket.on('player:left', ({ id }) => {
            eng.removePlayer(id);
            dispatch(playerLeft(id));
        });
        socket.on('player:updated', (p) => {
            eng.updatePlayerLook(p);
            dispatch(playerJoined(p));
        });
        socket.on('player:moved', (m) => eng.movePlayer(m));
        socket.on('vehicle:update', (v) => eng.vehicleUpdate(v));
        socket.on('vehicle:moved', (m) => eng.vehicleMoved(m));
        socket.on('world:set', ({ i, id }) => eng.applyEdit(i, id));
        socket.on('world:bulk', ({ edits }) => eng.applyBulk(edits));
        socket.on('chat:message', (m) => {
            dispatch(chatMessage(m));
            if (m.from && m.from !== pid) sfx.chat();
        });
        socket.on('emote', ({ id, kind }) => eng.emote(id, kind));
        socket.on('teleport', ({ pos, yaw }) => eng.teleport(pos, yaw));
        socket.on('game:state', (v) => {
            if (v) setOffset(v.now - Date.now());
            eng.setGame(v);
            dispatch(setGame(v));
        });
        socket.on('game:event', (ev) => {
            eng.gameEvent(ev);
            window.dispatchEvent(new CustomEvent('dc:game-event', { detail: ev }));
        });

        return () => {
            socket.removeAllListeners();
            closeSocket();
            eng.dispose();
            engineRef.current = null;
        };
        // The profile is read once on entry; changing it means re-entering the world.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, dispatch, isTouch]);

    /* ── Overlays pause the controls ────────────────────────────────── */
    const overlayGame = !!game?.overlay && !(game.id === 'drawGuess' && game.phase === 'over');
    const blocking = !!panel || overlayGame || game?.phase === 'over';
    useEffect(() => {
        engineRef.current?.setInputEnabled(!blocking);
    }, [blocking]);

    const send = useCallback((action) => openSocket().emit('game:action', action), []);
    const emote = useCallback((kind) => {
        openSocket().emit('emote', { kind });
    }, []);
    const startGame = useCallback(async (id) => {
        const res = await request('game:start', { id });
        if (!res.ok) toast(res.message);
        else setPanel(null);
    }, []);
    const closeGame = useCallback(() => openSocket().emit('game:close'), []);
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${code}`;
    const copyInvite = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            toast.success('Invite link copied — send it to your partner 💌');
        } catch {
            toast(inviteLink);
        }
    };
    const leave = () => {
        closeSocket();
        dispatch(leaveRoom());
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.pushState({}, '', url);
    };
    const goTo = (id) => {
        const r = engineRef.current?.remotes.get(id);
        if (!r) return;
        engineRef.current.teleport([r.pos.x + 1, r.pos.y, r.pos.z], engineRef.current.yaw);
        toast(`Teleported to ${players[id]?.name} 💫`);
    };

    /* ── Keyboard shortcuts that open things ────────────────────────── */
    useEffect(() => {
        const onKey = (e) => {
            if (/input|textarea/i.test(e.target?.tagName || '')) return;
            if (e.code === 'Escape') setPanel(null);
            if (panel || overlayGame) return;
            if (e.code === 'KeyT' || e.code === 'Enter') {
                e.preventDefault();
                setPanel('chat');
            } else if (e.code === 'KeyG') setPanel('games');
            else if (e.code === 'KeyE') {
                const eng = engineRef.current;
                if (eng?.riding || eng?.nearestVehicle()) eng.toggleVehicle();
                else setPanel('inventory');
            }
            else if (e.code === 'KeyH') emote('hearts');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [panel, overlayGame, emote]);

    const playerList = Object.values(players);
    const others = playerList.filter((p) => p.id !== me);
    const showClickToPlay = status === 'ready' && !locked && !blocking && !isTouch;

    return (
        <div className="fixed inset-0 select-none overflow-hidden bg-sky-300">
            <div ref={mount} className="absolute inset-0" />

            {/* Crosshair */}
            {(locked || isTouch) && !blocking && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-white mix-blend-difference" />
                    <div className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-white mix-blend-difference" />
                </div>
            )}

            {hud.underwater && <div className="pointer-events-none absolute inset-0 bg-blue-600/35" />}
            {flash === 'hit' && <div className="pointer-events-none absolute inset-0 bg-red-500/35" />}
            {game?.blind && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black">
                    <div className="text-center text-white">
                        <div className="text-6xl">🙈</div>
                        <div className="mt-3 text-2xl font-bold">Counting…</div>
                        <div className="text-white/60">No peeking! Your partner is hiding.</div>
                    </div>
                </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-10">
                {/* Top left: the room and who is here */}
                <div className="absolute left-3 top-3 flex flex-col gap-2">
                    <div className="pointer-events-auto glass flex items-center gap-2 px-3 py-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} title={connected ? 'Connected' : 'Reconnecting…'} />
                        <span className="pixel text-xs">{code}</span>
                        <button type="button" onClick={copyInvite} className="flex items-center gap-1 rounded-lg bg-love-500 px-2 py-1 text-xs font-semibold hover:bg-love-400">
                            <Link2 size={14} /> Invite
                        </button>
                    </div>
                    <div className="pointer-events-auto glass px-3 py-2 text-sm">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/60">In this world</div>
                        {playerList.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 py-0.5">
                                <span className="h-3 w-3 rounded-sm" style={{ background: p.shirt }} />
                                <span className="font-semibold">{p.id === me ? `${p.name} (you)` : p.name}</span>
                                {p.id !== me && (
                                    <button type="button" title={`Teleport to ${p.name}`} onClick={() => goTo(p.id)} className="ml-auto rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white">
                                        <Navigation size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {others.length === 0 && <div className="mt-1 max-w-48 text-xs text-white/70">Waiting for your partner… tap Invite and send them the link 💌</div>}
                    </div>
                </div>

                {/* Top centre: where you are, and the game bar */}
                <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-2">
                    {hud.zone && (
                        <div className="glass flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold">
                            <MapPin size={14} /> {hud.zone}
                        </div>
                    )}
                    {game && (
                        <GameHud
                            game={game}
                            me={me}
                            players={players}
                            offset={offset}
                            onAgain={() => startGame(game.id)}
                            onClose={closeGame}
                            noResults={game.id === 'coupleQuiz'}
                        />
                    )}
                </div>

                {/* Top right: buttons */}
                <div className="pointer-events-auto absolute right-3 top-3 flex flex-col gap-1.5 xl:flex-row xl:gap-2">
                    <IconButton title="Games (G)" onClick={() => setPanel('games')} active>
                        <Gamepad2 size={20} />
                    </IconButton>
                    <IconButton title="Blocks (E)" onClick={() => setPanel('inventory')}>
                        <Boxes size={20} />
                    </IconButton>
                    <IconButton title="Chat (T)" onClick={() => setPanel('chat')}>
                        <MessageCircle size={20} />
                    </IconButton>
                    <IconButton title={night ? 'Day' : 'Night'} onClick={() => { engine?.setNight(!night); setNight(!night); }}>
                        {night ? <Sun size={20} /> : <Moon size={20} />}
                    </IconButton>
                    <IconButton title="Camera (V)" onClick={() => engine?.cycleView()} active={hud.view > 0}>
                        <Eye size={20} />
                    </IconButton>
                    <IconButton title="Fly (F)" onClick={() => engine?.toggleFly()} active={hud.flying}>
                        <Feather size={20} />
                    </IconButton>
                    <IconButton title={muted ? 'Sound on' : 'Sound off'} onClick={() => { sfx.setMuted(!muted); setMuted(!muted); }}>
                        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </IconButton>
                    <IconButton title="Back to the front gate" onClick={() => engine?.teleport(SPAWN.pos, SPAWN.yaw)}>
                        <Home size={20} />
                    </IconButton>
                    <IconButton title="Leave world" onClick={leave}>
                        <LogOut size={20} />
                    </IconButton>
                </div>

                {/* Bottom */}
                <div className={`absolute left-3 ${isTouch ? 'top-48' : 'bottom-24'}`}>
                    <Chat messages={chat} me={me} open={panel === 'chat'} onSend={(text) => openSocket().emit('chat:send', { text })} onClose={() => setPanel(null)} />
                </div>
                <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
                    {hud.near && !blocking && (
                        <button type="button" onClick={() => engine?.toggleVehicle()} className="pointer-events-auto mc-btn pop">
                            🚙 Drive the {hud.near} <span className="rounded bg-white/25 px-1.5 text-xs">E</span>
                        </button>
                    )}
                    {hud.riding && (
                        <div className="pointer-events-auto glass pop flex items-center gap-3 px-4 py-2">
                            {hud.riding.seat === 'driver' ? (
                                <>
                                    <span className="pixel text-lg">{hud.riding.kmh}</span>
                                    <span className="text-xs text-white/70">km/h</span>
                                    <span className="hidden text-xs text-white/70 sm:inline">W/S drive · A/D steer · Shift nitro · Space brake · R reset</span>
                                </>
                            ) : (
                                <span className="text-sm">Riding along in the {hud.riding.name} 💕</span>
                            )}
                            <button type="button" onClick={() => engine?.toggleVehicle()} className="rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30">
                                Get out (E)
                            </button>
                        </div>
                    )}
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    {bar.hotbar.length > 0 && <Hotbar hotbar={bar.hotbar} slot={bar.slot} onSelect={(i) => engine?.selectSlot(i)} />}
                </div>
                <div className={`absolute right-16 flex flex-col items-end gap-2 xl:right-3 ${isTouch ? "top-28" : "bottom-3"}`}>
                    {game?.id === 'tictactoe' && game.phase === 'play' && <TicTacToePanel game={game} me={me} send={send} />}
                    {game?.id === 'memory' && game.phase === 'play' && <MemoryPanel game={game} me={me} players={players} send={send} />}
                    <EmoteBar onEmote={emote} />
                </div>
                {!isTouch && (
                    <div className="absolute bottom-3 left-3 hidden text-xs text-white/80 drop-shadow lg:block">
                        {hud.coords.join(', ')}
                    </div>
                )}

                {isTouch && status === 'ready' && !blocking && <TouchControls engine={engine} />}
            </div>

            {/* Panels */}
            {game?.id === 'drawGuess' && game.phase !== 'over' && <DrawGuessPanel game={game} me={me} players={players} offset={offset} send={send} />}
            {game?.id === 'coupleQuiz' && <QuizPanel game={game} me={me} players={players} send={send} onAgain={() => startGame('coupleQuiz')} onClose={closeGame} />}
            {panel === 'games' && <GameMenu current={game} playerCount={playerList.length} onStart={startGame} onEnd={() => { closeGame(); setPanel(null); }} onClose={() => setPanel(null)} />}
            {panel === 'inventory' && (
                <Inventory
                    hotbar={bar.hotbar}
                    slot={bar.slot}
                    onSelect={(i) => engine?.selectSlot(i)}
                    onPick={(id) => engine?.setHotbarBlock(bar.slot, id)}
                    onClose={() => setPanel(null)}
                />
            )}

            {showClickToPlay && (
                <button type="button" onClick={() => engine?.requestLock()} className="absolute inset-0 z-20 grid cursor-pointer place-items-center bg-black/25">
                    <div className="pop rounded-3xl bg-white/95 p-6 text-left shadow-2xl">
                        <div className="text-center text-2xl font-bold">Click to play 💖</div>
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
                            <span><b>WASD</b> walk · <b>Space</b> jump</span>
                            <span><b>Shift</b> sprint · <b>F</b> fly</span>
                            <span><b>Left click</b> break</span>
                            <span><b>Right click</b> place</span>
                            <span><b>1-9 / wheel</b> pick block</span>
                            <span><b>E</b> all blocks</span>
                            <span><b>G</b> games · <b>T</b> chat</span>
                            <span><b>H</b> hearts · <b>V</b> camera</span>
                        </div>
                        <div className="mt-4 text-center text-xs text-slate-400">Press Esc any time to get your mouse back</div>
                    </div>
                </button>
            )}

            {status !== 'ready' && (
                <div className="absolute inset-0 z-50 grid place-items-center bg-gradient-to-b from-love-200 to-sky-200">
                    <div className="text-center">
                        {status === 'error' ? (
                            <>
                                <div className="text-5xl">😿</div>
                                <div className="mt-3 text-xl font-bold">{error}</div>
                                <button type="button" className="mc-btn mt-4" onClick={leave}>
                                    Back to the lobby
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="floaty text-6xl">🏡</div>
                                <div className="pixel mt-4 text-sm text-slate-700">Building the dream house…</div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
