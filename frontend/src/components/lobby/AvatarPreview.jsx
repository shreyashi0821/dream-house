/**
 * A flat, front-on drawing of your blocky character, built from divs so the
 * lobby does not need a 3D canvas just to show an outfit.
 */
export default function AvatarPreview({ look, size = 10 }) {
    const u = size; // one "pixel" of the character
    const long = look.hairStyle === 'long';
    const block = (w, h, bg, extra = {}) => ({ width: w * u, height: h * u, background: bg, ...extra });

    return (
        <div className="relative flex flex-col items-center floaty select-none" style={{ width: 16 * u, filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.15))' }}>
            {/* hat */}
            <div style={{ height: 2 * u }} className="relative flex items-end justify-center">
                {look.hat === 'crown' && (
                    <div className="flex items-end gap-0" style={{ width: 8 * u }}>
                        {[2, 1, 2, 1, 2, 1, 2, 1].map((h, i) => (
                            <div key={i} style={block(1, h, '#ffcf33')} />
                        ))}
                    </div>
                )}
                {look.hat === 'cap' && <div style={block(9, 1.5, look.shirt, { borderRadius: `${u}px ${u}px 0 0` })} />}
                {look.hat === 'bow' && (
                    <div className="absolute flex" style={{ right: 3.5 * u, bottom: -0.5 * u }}>
                        <div style={block(1.5, 1.5, '#ff4d8d')} />
                        <div style={block(0.8, 0.8, '#ffd1e3', { alignSelf: 'center' })} />
                        <div style={block(1.5, 1.5, '#ff4d8d')} />
                    </div>
                )}
                {look.hat === 'flower' && <div className="absolute" style={{ right: 3.5 * u, bottom: -1.5 * u, fontSize: 2.2 * u }}>🌸</div>}
                {look.hairStyle === 'bun' && look.hat === 'none' && <div style={block(3, 1.5, look.hair)} />}
            </div>

            {/* head */}
            <div className="relative" style={block(8, 8, look.skin)}>
                <div className="absolute left-0 top-0" style={block(8, 2, look.hair)} />
                <div className="absolute left-0" style={{ ...block(1, long ? 6 : 2, look.hair), top: 2 * u }} />
                <div className="absolute right-0" style={{ ...block(1, long ? 6 : 2, look.hair), top: 2 * u }} />
                <div className="absolute" style={{ ...block(2, 1, '#fff'), left: u, top: 4 * u }}>
                    <div style={block(1, 1, '#2b1d3a', { marginLeft: u })} />
                </div>
                <div className="absolute" style={{ ...block(2, 1, '#fff'), left: 5 * u, top: 4 * u }}>
                    <div style={block(1, 1, '#2b1d3a')} />
                </div>
                <div className="absolute" style={{ ...block(1, 1, 'rgba(255,110,150,0.55)'), left: u, top: 5 * u }} />
                <div className="absolute" style={{ ...block(1, 1, 'rgba(255,110,150,0.55)'), left: 6 * u, top: 5 * u }} />
                <div className="absolute" style={{ ...block(2, 1, '#b5485f'), left: 3 * u, top: 6 * u }} />
            </div>

            {/* body and arms */}
            <div className="flex">
                <div className="flex flex-col">
                    <div style={block(3.5, 7, look.shirt, { boxShadow: 'inset -3px 0 0 rgba(0,0,0,0.08)' })} />
                    <div style={block(3.5, 3, look.skin)} />
                </div>
                <div style={block(8, 11, look.shirt)} />
                <div className="flex flex-col">
                    <div style={block(3.5, 7, look.shirt, { boxShadow: 'inset 3px 0 0 rgba(0,0,0,0.08)' })} />
                    <div style={block(3.5, 3, look.skin)} />
                </div>
            </div>

            {/* legs */}
            <div className="flex" style={{ marginTop: -1 * u }}>
                <div className="flex flex-col">
                    <div style={block(4, 9, look.pants, { boxShadow: 'inset -2px 0 0 rgba(0,0,0,0.12)' })} />
                    <div style={block(4, 1.5, '#2b2533')} />
                </div>
                <div className="flex flex-col">
                    <div style={block(4, 9, look.pants)} />
                    <div style={block(4, 1.5, '#2b2533')} />
                </div>
            </div>
            <div className="mt-2 rounded-full bg-black/10" style={{ width: 12 * u, height: 1.2 * u }} />
        </div>
    );
}
