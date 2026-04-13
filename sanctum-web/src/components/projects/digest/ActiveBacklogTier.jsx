import React, { useState } from 'react';
import { Pin } from 'lucide-react';
import StatusBadge from '../../ui/StatusBadge';

const COLLAPSED_LIMIT = 10;

function BacklogProjectRow({ project, pinned, pinDisabled, onPin, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-slate-200 font-medium text-sm truncate">{project.name}</span>
        <StatusBadge value={project.status} map="projectStatus" />
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{project.account_name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!pinned && !pinDisabled) onPin(project.id);
          }}
          disabled={pinned || pinDisabled}
          className={`p-1 rounded transition-colors ${
            pinned
              ? 'text-sanctum-gold cursor-default'
              : pinDisabled
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-500 hover:text-sanctum-gold'
          }`}
          title={pinned ? 'Already pinned' : pinDisabled ? 'Workbench full' : 'Pin to Workbench'}
        >
          <Pin size={14} className={pinned ? 'fill-current' : ''} />
        </button>
      </div>
    </div>
  );
}

export default function ActiveBacklogTier({ projects, pinnedIds, pinDisabled, onPin, onNavigate }) {
  const [expanded, setExpanded] = useState(false);

  if (projects.length === 0) return null;

  const visible = expanded ? projects : projects.slice(0, COLLAPSED_LIMIT);
  const hasMore = projects.length > COLLAPSED_LIMIT;

  return (
    <section className="space-y-1">
      <div className="px-1 mb-2">
        <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-slate-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Active Backlog
        </h3>
      </div>
      <div className="space-y-[1px]">
        {visible.map(p => (
          <BacklogProjectRow
            key={p.id}
            project={p}
            pinned={pinnedIds.has(p.id)}
            pinDisabled={pinDisabled}
            onPin={onPin}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-[10px] text-indigo-400 hover:underline uppercase font-bold tracking-widest px-1 mt-2"
        >
          {expanded ? 'Show fewer' : `Show all ${projects.length}`}
        </button>
      )}
    </section>
  );
}
