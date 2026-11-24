import type React from 'react';

/** Custom MIME type so only guests (not files or text) can be dropped on chairs. */
export const GUEST_DRAG_TYPE = 'application/x-wedding-guest';

export function startGuestDrag(e: React.DragEvent, guestId: string) {
    e.dataTransfer.setData(GUEST_DRAG_TYPE, guestId);
    e.dataTransfer.setData('text/plain', guestId);
    e.dataTransfer.effectAllowed = 'move';
    document.body.classList.add('dragging-guest');
    const end = () => {
        document.body.classList.remove('dragging-guest');
        window.removeEventListener('dragend', end, true);
    };
    window.addEventListener('dragend', end, true);
}

export const readDraggedGuest = (e: React.DragEvent) => e.dataTransfer.getData(GUEST_DRAG_TYPE) || null;

export const acceptsGuest = (e: React.DragEvent) => e.dataTransfer.types.includes(GUEST_DRAG_TYPE);
