import React from 'react';
import { Calendar, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { computeMetrics } from '../../../utils/projectMetrics';

function formatCurrency(value) {
  const n = Number(value);
  if (!n) return null;
  return `$${n.toLocaleString()}`;
}

function CompletionBar({ pct }) {
  const color = pct >= 75 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-600';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DigestProjectCard({ project, onNavigate, strategy }) {
  const m = computeMetrics(project);
  const price = formatCurrency(m.revenue);

  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-3 hover:border-sanctum-gold/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white group-hover:text-sanctum-gold transition-colors truncate">
            {project.name}
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">{project.account_name}</p>
        </div>
        {price && (
          <span className="text-xs text-slate-500 font-mono shrink-0">{price}</span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4 flex-wrap">
        {strategy === 'quickwins' && (
          <>
            <CompletionBar pct={m.completionPct} />
            <span className="text-xs text-slate-400">
              {m.remainingTickets} ticket{m.remainingTickets !== 1 ? 's' : ''} left
            </span>
          </>
        )}

        {strategy === 'roi' && (
          <>
            {m.roi > 0 ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-green-400">
                <TrendingUp size={14} />
                {formatCurrency(m.roi)}/milestone
              </span>
            ) : (
              <span className="text-xs text-slate-500 italic">No milestones planned</span>
            )}
            <span className="text-xs text-slate-400">
              {m.milestoneCount} milestone{m.milestoneCount !== 1 ? 's' : ''}
            </span>
          </>
        )}

        {strategy === 'stale' && (
          <>
            {!m.hasPlannedWork ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-red-400">
                <AlertTriangle size={14} />
                No milestones — idea only
              </span>
            ) : m.completionPct === 0 && m.totalTickets > 0 ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                <AlertTriangle size={14} />
                Planned but not started ({m.totalTickets} tickets)
              </span>
            ) : (
              <>
                <CompletionBar pct={m.completionPct} />
                <span className="text-xs text-slate-400">{m.remainingTickets} remaining</span>
              </>
            )}
          </>
        )}

        {!strategy && m.totalTickets > 0 && (
          <CompletionBar pct={m.completionPct} />
        )}

        {project.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-500 font-mono ml-auto">
            <Calendar size={12} />
            {project.due_date}
          </span>
        )}
      </div>
    </div>
  );
}
