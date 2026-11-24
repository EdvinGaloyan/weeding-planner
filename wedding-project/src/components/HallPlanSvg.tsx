import { useTranslation } from 'react-i18next';
import { HallData, HallElement, TableData } from '../types/types.ts';
import { tableDimensions } from '../utils/seating.ts';
import { chairLayout } from '../utils/chairs.ts';
import { elementLabelKey, elementShape, PARALLELOGRAM_SKEW } from '../utils/elements.ts';
import { tableShortLabel } from '../utils/labels.ts';
import { seatIndex, seatKey } from '../utils/guests.ts';

interface HallPlanSvgProps {
    hall: Pick<HallData, 'tables' | 'elements'> & Partial<Pick<HallData, 'guests' | 'groups'>>;
    /** Table to emphasise (the "find your table" page). */
    highlightTableId?: number;
    /** Show the table name under the number. */
    showNames?: boolean;
    className?: string;
}

const PAD = 40;
const CHAIR_R = 8;

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
    const a = (deg * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Bounding box of everything in the hall, so the plan is always tightly framed. */
function bounds(tables: TableData[], elements: HallElement[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (cx: number, cy: number, r: number) => {
        minX = Math.min(minX, cx - r);
        minY = Math.min(minY, cy - r);
        maxX = Math.max(maxX, cx + r);
        maxY = Math.max(maxY, cy + r);
    };
    tables.forEach(table => {
        const { size, height } = tableDimensions(table);
        add(table.x + size / 2, table.y + height / 2, Math.hypot(size / 2, height / 2) + 30);
    });
    elements.forEach(e => add(e.x + e.w / 2, e.y + e.h / 2, Math.hypot(e.w / 2, e.h / 2)));
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 800, h: 500 };
    return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

/** Static, print-friendly drawing of the hall (used for printing and the public QR page). */
function HallPlanSvg({ hall, highlightTableId, showNames = true, className }: HallPlanSvgProps) {
    const { t } = useTranslation();
    const { tables, elements } = hall;
    const box = bounds(tables, elements);
    const seats = seatIndex(hall.guests || []);
    const groupColor = new Map((hall.groups || []).map(group => [group.id, group.color]));

    return (
        <svg
            className={`hall-plan-svg ${className || ''}`}
            viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
        >
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#fffdf8" rx={16} />

            {elements.map(element => {
                const cx = element.x + element.w / 2;
                const cy = element.y + element.h / 2;
                const shape = elementShape(element);
                const slant = (element.h * Math.tan((PARALLELOGRAM_SKEW * Math.PI) / 180)) / 2;
                const label = element.label || t(elementLabelKey(element.kind));
                const vertical = element.rotation % 180 !== 0;
                return (
                    <g key={element.id} transform={`rotate(${element.rotation} ${cx} ${cy})`}>
                        {shape === 'round' ? (
                            <ellipse cx={cx} cy={cy} rx={element.w / 2} ry={element.h / 2} className={`plan-el plan-el-${element.kind}`} />
                        ) : shape === 'parallelogram' ? (
                            <polygon
                                points={`${element.x + slant},${element.y} ${element.x + element.w + slant},${element.y} ${element.x + element.w - slant},${element.y + element.h} ${element.x - slant},${element.y + element.h}`}
                                className={`plan-el plan-el-${element.kind}`}
                            />
                        ) : (
                            <rect x={element.x} y={element.y} width={element.w} height={element.h} rx={10} className={`plan-el plan-el-${element.kind}`} />
                        )}
                        {element.kind !== 'column' && (
                            <text
                                x={cx}
                                y={cy}
                                className="plan-el-label"
                                transform={vertical ? `rotate(${-element.rotation} ${cx} ${cy})` : undefined}
                                fontSize={Math.max(11, Math.min(22, Math.min(element.w, element.h) / 3.2))}
                            >
                                {label}
                            </text>
                        )}
                    </g>
                );
            })}

            {tables.map(table => {
                const { size, height } = tableDimensions(table);
                const cx = table.x + size / 2;
                const cy = table.y + height / 2;
                const highlighted = table.id === highlightTableId;
                const dimmed = highlightTableId !== undefined && !highlighted;
                const chairs = chairLayout(table, size, height, 18);
                const number = tableShortLabel(tables, table);
                return (
                    <g key={table.id} className={`plan-table ${highlighted ? 'highlight' : ''} ${dimmed ? 'dimmed' : ''}`}>
                        {chairs.map((chair, i) => {
                            const p = rotatePoint(table.x + chair.x, table.y + chair.y, cx, cy, table.rotation);
                            const guest = seats.get(seatKey(table.id, i));
                            const fill = guest ? (guest.groupId && groupColor.get(guest.groupId)) || '#b24f66' : undefined;
                            return <circle key={i} cx={p.x} cy={p.y} r={CHAIR_R} className="plan-chair" style={fill ? { fill } : undefined} />;
                        })}
                        {table.shape === 'round' && !table.isHeadTable ? (
                            <circle cx={cx} cy={cy} r={size / 2} className="plan-table-shape" />
                        ) : (
                            <rect
                                x={table.x}
                                y={table.y}
                                width={size}
                                height={height}
                                rx={12}
                                className={`plan-table-shape ${table.isHeadTable ? 'head' : ''}`}
                                transform={`rotate(${table.rotation} ${cx} ${cy})`}
                            />
                        )}
                        <text x={cx} y={cy - (showNames && table.tableName ? 8 : 0)} className="plan-table-number" fontSize={Math.min(40, Math.max(20, Math.min(size, height) / 3))}>
                            {number}
                        </text>
                        {showNames && table.tableName && (
                            <text x={cx} y={cy + Math.min(26, height / 4)} className="plan-table-name" fontSize={13}>
                                {table.tableName.length > 22 ? `${table.tableName.slice(0, 21)}…` : table.tableName}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

export default HallPlanSvg;
