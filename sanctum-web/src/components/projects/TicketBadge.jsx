import React, { useRef, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

const VARIANT_CLASSES = {
  current: 'bg-blue-500/10 text-blue-400',
  next: 'bg-slate-700/50 text-slate-500',
};

export default function TicketBadge({ ticketId, variant = 'current', onOpenModal }) {
  const { addToast } = useToast();
  const clickTimer = useRef(null);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      navigator.clipboard.writeText(`#${ticketId}`).then(() => {
        addToast(`Copied #${ticketId}`, 'success');
      });
    }, 200);
  }, [ticketId, addToast]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    clearTimeout(clickTimer.current);
    if (onOpenModal) onOpenModal(ticketId);
  }, [ticketId, onOpenModal]);

  return (
    <span
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`inline-block text-[11px] px-2 py-0.5 rounded cursor-pointer select-none ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.current}`}
    >
      #{ticketId}
    </span>
  );
}
