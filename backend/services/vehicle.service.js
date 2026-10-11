import { VEHICLE_SPAWNS, SX, SY, SZ } from '../../shared/world.js';

/**
 * The off-road vehicles. Each car is driven by exactly one browser — its
 * driver's — which simulates the physics and streams the result; the server
 * only decides who sits where and passes positions along.
 */

const ENTER_RANGE = 6;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export const createVehicles = () =>
    VEHICLE_SPAWNS.map((v) => ({ ...v, pos: [...v.pos], driver: null, passenger: null, speed: 0, tilt: [0, 0], steer: 0 }));

export const publicVehicle = (v) => ({
    id: v.id,
    kind: v.kind,
    color: v.color,
    pos: v.pos,
    yaw: v.yaw,
    driver: v.driver,
    passenger: v.passenger,
    speed: v.speed,
    tilt: v.tilt,
    steer: v.steer,
});

export const seatOf = (room, pid) => {
    for (const v of room.vehicles) {
        if (v.driver === pid) return { vehicle: v, seat: 'driver' };
        if (v.passenger === pid) return { vehicle: v, seat: 'passenger' };
    }
    return null;
};

/** Sit someone in a car: the driver's seat if it is free, else next to the driver. */
export function enterVehicle(room, pid, id) {
    const v = room.vehicles.find((x) => x.id === id);
    if (!v) return { ok: false, message: 'That car is gone.' };
    if (seatOf(room, pid)) return { ok: false, message: 'You are already in a car.' };
    const p = room.players.get(pid);
    if (!p || Math.hypot(p.pos[0] - v.pos[0], p.pos[2] - v.pos[2]) > ENTER_RANGE) return { ok: false, message: 'Walk a little closer to the car.' };
    if (!v.driver) v.driver = pid;
    else if (!v.passenger) v.passenger = pid;
    else return { ok: false, message: 'Both seats are taken.' };
    return { ok: true, vehicle: v, seat: v.driver === pid ? 'driver' : 'passenger' };
}

/** Leave whatever car you are in. If the driver hops out, the passenger slides over. */
export function exitVehicle(room, pid) {
    const s = seatOf(room, pid);
    if (!s) return null;
    const v = s.vehicle;
    if (s.seat === 'driver') {
        v.driver = v.passenger;
        v.passenger = null;
        v.speed = 0;
    } else v.passenger = null;
    return v;
}

export function moveVehicle(room, pid, data = {}) {
    const v = room.vehicles.find((x) => x.id === data.id);
    if (!v || v.driver !== pid) return null;
    const p = data.p;
    if (!Array.isArray(p) || p.length !== 3 || !p.every(finite) || !finite(data.r)) return null;
    v.pos = [Math.max(0, Math.min(SX, p[0])), Math.max(-20, Math.min(SY + 20, p[1])), Math.max(0, Math.min(SZ, p[2]))];
    v.yaw = data.r;
    v.speed = finite(data.s) ? Math.max(-60, Math.min(60, data.s)) : 0;
    v.steer = finite(data.st) ? Math.max(-1, Math.min(1, data.st)) : 0;
    v.tilt = Array.isArray(data.t) && data.t.length === 2 && data.t.every(finite) ? data.t.map((n) => Math.max(-1.2, Math.min(1.2, n))) : [0, 0];
    return v;
}

/** Everyone out — games start on foot. Returns the cars that changed. */
export function ejectAll(room) {
    const changed = [];
    for (const v of room.vehicles) {
        if (v.driver || v.passenger) {
            v.driver = v.passenger = null;
            v.speed = 0;
            changed.push(v);
        }
    }
    return changed;
}

/** Put a car back on its parking spot (for when it ends up in the lake). */
export function resetVehicle(room, pid, id) {
    const v = room.vehicles.find((x) => x.id === id);
    if (!v || (v.driver && v.driver !== pid)) return null;
    const home = VEHICLE_SPAWNS.find((s) => s.id === id);
    v.pos = [...home.pos];
    v.yaw = home.yaw;
    v.speed = 0;
    v.tilt = [0, 0];
    return v;
}
