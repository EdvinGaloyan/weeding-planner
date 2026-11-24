import React, { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Guest } from '../types/types.ts';
import { GUEST_DRAG_TYPE, readDraggedGuest, startGuestDrag } from '../utils/dnd.ts';

interface ChairProps {
    index: number;
    x: number;
    y: number;
    guest?: Guest;
    groupColor?: string;
    /** Bride & groom seats get a subtle highlight. */
    isCouple?: boolean;
    /** Hover tooltip with the seat / guest name (off for the head table). */
    showTooltip?: boolean;
    /** Search result highlight. */
    isMatch?: boolean;
    /** Counter-rotation so the initial stays upright on rotated tables. */
    counterRotation: number;
    onEdit: (chairIndex: number) => void;
    onDropGuest: (chairIndex: number, guestId: string) => void;
}

function Chair({ index, x, y, guest, groupColor, isCouple, showTooltip = true, isMatch, counterRotation, onEdit, onDropGuest }: ChairProps) {
    const { t } = useTranslation();
    const [isOver, setIsOver] = useState(false);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // don't start dragging the table
        onEdit(index);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
        const guestId = readDraggedGuest(e);
        if (guestId) onDropGuest(index, guestId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(GUEST_DRAG_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!isOver) setIsOver(true);
    };

    const style = {
        left: `${x}px`,
        top: `${y}px`,
        ...(guest && groupColor ? { '--chair-color': groupColor } : {}),
    } as React.CSSProperties;

    return (
        <Tooltip
            label={guest ? guest.name : `${t('seat')} ${index + 1}`}
            color={guest ? 'wine.9' : undefined}
            disabled={!showTooltip}
        >
            <div
                className={`chair ${guest ? 'has-guest' : ''} ${guest && groupColor ? 'grouped' : ''} ${isCouple ? 'couple' : ''} ${isOver ? 'drop-over' : ''} ${isMatch ? 'match' : ''}`}
                style={style}
                onClick={handleClick}
                draggable={!!guest}
                onDragStart={e => {
                    e.stopPropagation();
                    if (guest) startGuestDrag(e, guest.id);
                }}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsOver(false)}
                onDrop={handleDrop}
            >
                {guest && (
                    <span className="chair-initial" style={{ transform: `rotate(${-counterRotation}deg)` }}>
                        {guest.name.charAt(0).toUpperCase()}
                    </span>
                )}
            </div>
        </Tooltip>
    );
}

export default Chair;
