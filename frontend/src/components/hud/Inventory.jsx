import { X } from 'lucide-react';
import { BLOCKS } from '@shared/blocks.js';
import { blockIcon } from '@/engine/textures';
import Hotbar from './Hotbar';

const PLACEABLE = BLOCKS.filter((b) => b.placeable);

/** Every block you can build with. Click one to put it in the selected slot. */
export default function Inventory({ hotbar, slot, onSelect, onPick, onClose }) {
    return (
        <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="pop w-full max-w-2xl rounded-3xl bg-[#c6c6c6] p-4 shadow-2xl ring-4 ring-white/60">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="pixel text-sm text-slate-800">Blocks</h2>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-black/10" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>
                <div className="grid max-h-[50vh] grid-cols-6 gap-1.5 overflow-y-auto rounded-xl bg-[#8b8b8b] p-2 sm:grid-cols-10">
                    {PLACEABLE.map((b) => (
                        <button
                            key={b.id}
                            type="button"
                            title={b.name}
                            onClick={() => onPick(b.id)}
                            className="grid aspect-square place-items-center rounded-md bg-[#a0a0a0] hover:bg-white/60"
                        >
                            <img src={blockIcon(b.id)} alt={b.name} className="h-9 w-9 [image-rendering:pixelated]" draggable={false} />
                        </button>
                    ))}
                </div>
                <p className="mt-3 text-center text-xs text-slate-700">Pick a slot below, then click a block to put it there. Middle-click a block in the world to copy it.</p>
                <div className="mt-2 flex justify-center">
                    <Hotbar hotbar={hotbar} slot={slot} onSelect={onSelect} />
                </div>
            </div>
        </div>
    );
}
