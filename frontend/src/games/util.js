import * as THREE from 'three';

export const nameOf = (engine, id) => (id === engine.meId ? 'You' : engine.remotes.get(id)?.data.name || 'Someone');
export const colourOf = (engine, id) => (id === engine.meId ? engine.profile.shirt : engine.remotes.get(id)?.data.shirt || '#ff4d8d');
export const toast = (engine, text) => engine.ui('toast', { text });

export function disposeGroup(engine, group) {
    if (!group) return;
    engine.scene.remove(group);
    group.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
}

export const headOf = (engine, id) => {
    const p = engine.playerPos(id);
    return p ? new THREE.Vector3(p.x, p.y + 2.2, p.z) : null;
};
