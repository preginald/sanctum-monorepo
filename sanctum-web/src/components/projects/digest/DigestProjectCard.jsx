import React from 'react';
import { Calendar, TrendingUp } from 'lucide-react';
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

function ScoreBar({ score }) {
  const color = score >= 60 ? 'bg-green-500' : score >= 35 ? 'bg-amber-500' : 'bg-slate-600';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-6 text-right">{score}</span>
    </div>
  );
}

function FactorPill({ label, score, max = 25 }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 60 ? 'text-green-400' : pct >= 30 ? 'text-amber-400' : 'text-slate-500';
  return (
    <span className={`text-[11px] ${color}`}>
      {label} {score}/{max}
    </span>
  );
}

/** In-flight project card — shows technical metrics */
export function InFlightCard({ project, onNavigate }) {
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
        {price && <span className="text-xs text-slate-500 font-mono shrink-0">{price}</span>}
      </div>
      {m.totalTickets > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-4">
          <CompletionBar pct={m.completionPct} />
          <span className="text-xs text-slate-400">
            {m.remainingTickets} ticket{m.remainingTickets !== 1 ? 's' : ''} left
          </span>
          {project.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono ml-auto">
              <Calendar size={12} />
              {project.due_date}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Backlog project card — shows fundamental analysis */
export function BacklogCard({ project, onNavigate, analysis }) {
  const price = formatCurrency(Number(project.quoted_price || project.budget) || 0);

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
        <div className="flex items-center gap-3 shrink-0">
          {price && <span className="text-xs text-slate-500 font-mono">{price}</span>}
          {analysis && <ScoreBar score={analysis.total} />}
        </div>
      </div>
      {analysis && (
        <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-3 flex-wrap">
          {Object.values(analysis.factors).map(f => (
            <FactorPill key={f.label} label={f.label} score={f.score} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Completed project card — minimal */
export function CompletedCard({ project, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 mb-3 hover:border-sanctum-gold/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-300 group-hover:text-sanctum-gold transition-colors truncate">
            {project.name}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">{project.account_name}</p>
        </div>
        {project.due_date && (
          <span className="text-xs text-slate-600 font-mono shrink-0">{project.due_date}</span>
        )}
      </div>
    </div>
  );
}
