import React, { useRef, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

const VARIANT_CLASSES = {
  current: 'bg-blue-500/10 text-blue-400',
  next: 'bg-slate-700/50 text-slate-500',
};

const STATUS_PILL_CLASSES = {
  new: 'bg-gray-100 text-gray-500',
  recon: 'bg-purple-100 text-purple-700',
  proposal: 'bg-purple-100 text-purple-700',
  pending: 'bg-amber-100 text-amber-700',
  implementation: 'bg-blue-100 text-blue-700',
  verification: 'bg-green-100 text-green-700',
  review: 'bg-green-100 text-green-700',
  resolved: 'bg-green-100 text-green-700',
};

const STATUS_LABELS = {
  implementation: 'impl',
  verification: 'verify',
};

export default function TicketBadge({ ticketId, variant = 'current', status, onOpenModal }) {
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

  const pillClasses = status ? STATUS_PILL_CLASSES[status] : null;
  const pillLabel = status ? (STATUS_LABELS[status] || status) : null;

  return (
    <span
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded cursor-pointer select-none ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.current}`}
    >
      #{ticketId}
      {pillClasses && (
        <span
          className={`inline-block text-[10px] leading-none py-[1px] px-[6px] rounded-[3px] ${pillClasses}`}
        >
          {pillLabel}
        </span>
      )}
    </span>
  );
}
