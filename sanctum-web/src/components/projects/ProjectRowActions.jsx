import React from 'react';
import { Pin, PinOff, Maximize2, ExternalLink } from 'lucide-react';

export default function ProjectRowActions({ projectId, isPinned, onPin, onUnpin, onOpenModal }) {
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {isPinned ? (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(projectId); }}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
          title="Unpin from workbench"
        >
          <PinOff size={14} className="stroke-sanctum-gold hover:stroke-slate-200" />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onPin(projectId); }}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
          title="Pin to workbench"
        >
          <Pin size={14} className="stroke-slate-500 hover:stroke-slate-200" />
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); if (onOpenModal) onOpenModal(projectId); }}
        className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
        title="Open detail"
      >
        <Maximize2 size={14} className="stroke-slate-500 hover:stroke-slate-200" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); window.open(`/projects/${projectId}`, '_blank'); }}
        className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
        title="Open in new tab"
      >
        <ExternalLink size={14} className="stroke-slate-500 hover:stroke-slate-200" />
      </button>
    </div>
  );
}
