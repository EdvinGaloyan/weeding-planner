// Hand-drawn style SVG illustrations used across the planner.
// Pure SVG so they scale crisply and need no external image downloads.

interface IllustrationProps {
    size?: number;
    className?: string;
}

/** Two interlocked wedding rings framed by a delicate laurel wreath. */
export function RingsWreath({ size = 96, className }: IllustrationProps) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
            <defs>
                <linearGradient id="rw-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#EED9AE" />
                    <stop offset="0.5" stopColor="#C9A469" />
                    <stop offset="1" stopColor="#8C6A3A" />
                </linearGradient>
                <radialGradient id="rw-glow" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stopColor="#FFFFFF" />
                    <stop offset="1" stopColor="#F6EDE0" />
                </radialGradient>
            </defs>

            <circle cx="60" cy="60" r="56" fill="url(#rw-glow)" />

            {/* Laurel — left branch */}
            <g stroke="#9CAF88" strokeWidth="1.4" strokeLinecap="round">
                <path d="M38 96 C 22 82, 16 60, 26 36" />
                {[
                    [24, 46, -40], [21, 58, -20], [22, 70, 0], [27, 81, 20], [34, 90, 40],
                ].map(([x, y, r], i) => (
                    <ellipse key={`l${i}`} cx={x} cy={y} rx="3.4" ry="7" fill="#B7C7A6" stroke="none"
                             transform={`rotate(${r} ${x} ${y})`} />
                ))}
            </g>
            {/* Laurel — right branch */}
            <g stroke="#9CAF88" strokeWidth="1.4" strokeLinecap="round">
                <path d="M82 96 C 98 82, 104 60, 94 36" />
                {[
                    [96, 46, 40], [99, 58, 20], [98, 70, 0], [93, 81, -20], [86, 90, -40],
                ].map(([x, y, r], i) => (
                    <ellipse key={`r${i}`} cx={x} cy={y} rx="3.4" ry="7" fill="#B7C7A6" stroke="none"
                             transform={`rotate(${r} ${x} ${y})`} />
                ))}
            </g>

            {/* Blush blossoms */}
            {[[30, 32], [90, 32], [60, 100]].map(([x, y], i) => (
                <g key={`f${i}`} transform={`translate(${x} ${y})`}>
                    {[0, 72, 144, 216, 288].map(a => (
                        <ellipse key={a} cx="0" cy="-4" rx="3" ry="4.4" fill="#E9C3C7" transform={`rotate(${a})`} />
                    ))}
                    <circle r="2" fill="#C9A469" />
                </g>
            ))}

            {/* Rings */}
            <circle cx="51" cy="64" r="15" stroke="url(#rw-gold)" strokeWidth="4.5" />
            <circle cx="69" cy="64" r="15" stroke="url(#rw-gold)" strokeWidth="4.5" />
            {/* Diamond */}
            <path d="M69 43 l5 5 -5 6 -5 -6z" fill="#FDFBF7" stroke="#C9A469" strokeWidth="1.2" />
            <path d="M64 48 h10" stroke="#C9A469" strokeWidth="0.8" />
        </svg>
    );
}

/** Thin ornamental divider with a center flourish. */
export function Flourish({ width = 180, className }: { width?: number; className?: string }) {
    return (
        <svg className={className} width={width} height={14} viewBox="0 0 180 14" fill="none" aria-hidden>
            <path d="M0 7 H70" stroke="#D9C29A" strokeWidth="1" />
            <path d="M110 7 H180" stroke="#D9C29A" strokeWidth="1" />
            <path d="M72 7 C 80 0, 86 0, 90 7 C 94 14, 100 14, 108 7" stroke="#B8925A" strokeWidth="1.2" />
            <path d="M72 7 C 80 14, 86 14, 90 7 C 94 0, 100 0, 108 7" stroke="#B8925A" strokeWidth="1.2" />
            <circle cx="90" cy="7" r="2" fill="#C98F96" />
        </svg>
    );
}

/** Round banquet table with chairs — used in the shape picker. */
export function RoundTableIcon({ size = 28 }: { size?: number }) {
    const chairs = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return [16 + 12.5 * Math.cos(a), 16 + 12.5 * Math.sin(a)];
    });
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
            <circle cx="16" cy="16" r="8.5" fill="#FBF6EE" stroke="currentColor" strokeWidth="1.5" />
            {chairs.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="currentColor" />)}
        </svg>
    );
}

/** Rectangular banquet table with chairs — used in the shape picker. */
export function RectTableIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
            <rect x="6" y="10" width="20" height="12" rx="2" fill="#FBF6EE" stroke="currentColor" strokeWidth="1.5" />
            {[10, 16, 22].map(x => <circle key={`t${x}`} cx={x} cy="6" r="2.2" fill="currentColor" />)}
            {[10, 16, 22].map(x => <circle key={`b${x}`} cx={x} cy="26" r="2.2" fill="currentColor" />)}
        </svg>
    );
}
