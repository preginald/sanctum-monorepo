import React from 'react';
import { CheckCircle } from 'lucide-react';
import { computeMetrics } from '../../../utils/projectMetrics';

// ---------------------------------------------------------------------------
// Leverage type display config
// ---------------------------------------------------------------------------
const LEVERAGE_TYPES = {
  access_unblocking:        { label: 'Access',     color: 'text-orange-400', bg: 'bg-orange-500/20' },
  resource_ceiling_removal: { label: 'Ceiling',    color: 'text-red-400',    bg: 'bg-red-500/20' },
  capability_multiplier:    { label: 'Capability', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  ecosystem_accelerator:    { label: 'Ecosystem',  color: 'text-blue-400',   bg: 'bg-blue-500/20' },
  dual_stakeholder_qol:     { label: 'Dual QoL',   color: 'text-green-400',  bg: 'bg-green-500/20' },
};

function LeveragePills({ types }) {
  if (!types || types.length === 0) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {types.map(type => {
        const cfg = LEVERAGE_TYPES[type];
        if (!cfg) return null;
        return (
          <span
            key={type}
            className={`px-1.5 py-0.5 rounded-sm ${cfg.bg} ${cfg.color} text-[9px] font-bold uppercase tracking-tight`}
          >
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

function LeverageTypeLabels({ types }) {
  if (!types || types.length === 0) return null;
  return (
    <div className="flex gap-1">
      {types.map(type => {
        const cfg = LEVERAGE_TYPES[type];
        if (!cfg) return null;
        return (
          <span key={type} className={`text-[9px] font-black uppercase ${cfg.color}`}>
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: Hero cards for Recommended Parallel Set
// ---------------------------------------------------------------------------
export function HeroCard({ project, analysis, onNavigate }) {
  const leverageTypes = project.leverage_data?.types || [];
  const score = analysis?.total || 0;

  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="h-[120px] relative p-4 bg-slate-800/80 rounded border border-indigo-500/20 flex flex-col justify-between hover:border-indigo-400/40 cursor-pointer transition-all"
    >
      <div className="flex justify-between items-start">
        <span className="text-indigo-300 text-[10px] font-black tracking-widest uppercase">
          {project._agent || 'Unassigned'}
        </span>
        <span className="text-xl font-black text-white leading-none">
          {score}
          <span className="text-[10px] font-normal text-slate-400">/125</span>
        </span>
      </div>
      <div>
        <h3 className="text-base font-bold text-white mb-2 truncate">{project.name}</h3>
        <LeveragePills types={leverageTypes} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: In-flight table row (rendered as <tr>)
// ---------------------------------------------------------------------------
export function InFlightRow({ project, onNavigate, even }) {
  const m = computeMetrics(project);

  return (
    <tr
      onClick={() => onNavigate(project.id)}
      className={`h-9 hover:bg-slate-700/20 transition-colors cursor-pointer ${
        even ? 'bg-slate-800/30' : ''
      }`}
    >
      <td className="px-4 font-bold text-white text-[13px]">{project.name}</td>
      <td className="px-4 text-slate-400 text-[13px]">{project.account_name}</td>
      <td className="px-4">
        <div className="w-32 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full"
            style={{ width: `${m.completionPct}%` }}
          />
        </div>
      </td>
      <td className="px-4 text-center font-mono text-slate-400 text-[11px]">
        {m.remainingTickets} rem.
      </td>
      <td className="px-4 text-right font-mono text-slate-400 text-[11px]">
        {project.due_date || '—'}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Backlog row — score, name, factor dots, leverage type, bar
// ---------------------------------------------------------------------------
export function BacklogRow({ project, analysis, onNavigate }) {
  const score = analysis?.total || 0;
  const pct = Math.round((score / 125) * 100);
  const leverageTypes = project.leverage_data?.types || [];

  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="flex items-center gap-4 px-4 py-2 bg-slate-800/60 rounded border border-slate-700/30 hover:border-indigo-500/30 cursor-pointer transition-all"
    >
      {/* Score */}
      <div className="w-16 flex flex-col items-center border-r border-slate-700/50 pr-2 shrink-0">
        <span className="text-base font-black text-indigo-300">{score}</span>
        <span className="text-[9px] text-slate-500 font-bold">/ 125</span>
      </div>

      {/* Name + leverage type labels */}
      <div className="min-w-[140px] shrink-0">
        <h4 className="text-xs font-bold text-white truncate">{project.name}</h4>
        <LeverageTypeLabels types={leverageTypes} />
      </div>

      {/* Factor pills */}
      <div className="flex flex-wrap gap-1">
        {analysis && Object.values(analysis.factors).map(f => (
          <span
            key={f.abbrev}
            className={`px-1.5 py-0 rounded-sm text-[9px] uppercase ${
              f.abbrev === 'L'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {f.label}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-32 ml-auto shrink-0">
        <div className="w-full h-1 bg-slate-700 rounded-full">
          <div
            className="h-full bg-indigo-400 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Completed row — muted minimal
// ---------------------------------------------------------------------------
export function CompletedRow({ project, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="flex justify-between items-center py-2 px-4 border-b border-slate-700/20 hover:bg-slate-800/30 cursor-pointer transition-all"
    >
      <span className="text-xs font-medium text-slate-500">{project.name}</span>
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-mono text-slate-600">{project.account_name}</span>
        <CheckCircle size={14} className="text-green-600/50" />
      </div>
    </div>
  );
}
