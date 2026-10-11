import { blockIcon } from '@/engine/textures';
import { BLOCKS } from '@shared/blocks.js';

/** The nine-slot bar at the bottom, block-game style. */
export default function Hotbar({ hotbar, slot, onSelect }) {
    return (
        <div className="pointer-events-auto flex gap-1 rounded-xl bg-black/45 p-1.5 backdrop-blur-sm">
            {hotbar.map((id, i) => (
                <button
                    key={i}
                    type="button"
                    title={BLOCKS[id]?.name}
                    onClick={() => onSelect(i)}
                    className={`relative grid h-11 w-11 place-items-center rounded-lg border-2 transition sm:h-12 sm:w-12 ${
                        i === slot ? 'border-white bg-white/25 scale-110' : 'border-white/10 bg-black/20 hover:bg-white/10'
                    }`}
                >
                    <img src={blockIcon(id)} alt="" className="h-8 w-8 [image-rendering:pixelated] sm:h-9 sm:w-9" draggable={false} />
                    <span className="absolute left-1 top-0.5 text-[10px] font-bold text-white/70">{i + 1}</span>
                </button>
            ))}
        </div>
    );
}
