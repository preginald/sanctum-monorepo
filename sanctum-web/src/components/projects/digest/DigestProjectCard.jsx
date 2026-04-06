import React from 'react';
import { CheckCircle, Sparkles, MoreVertical } from 'lucide-react';
import { computeMetrics } from '../../../utils/projectMetrics';

// ---------------------------------------------------------------------------
// Leverage type display config
// ---------------------------------------------------------------------------
const LEVERAGE_TYPES = {
  access_unblocking:        { label: 'ACCESS',     text: 'text-amber-500',  pill: 'bg-amber-900/40 text-amber-400 border border-amber-800/50' },
  resource_ceiling_removal: { label: 'CEILING',    text: 'text-red-400',    pill: 'bg-red-900/40 text-red-400 border border-red-800/50' },
  capability_multiplier:    { label: 'CAPABILITY', text: 'text-purple-400', pill: 'bg-purple-900/40 text-purple-400 border border-purple-800/50' },
  ecosystem_accelerator:    { label: 'ECOSYSTEM',  text: 'text-blue-400',   pill: 'bg-blue-900/40 text-blue-400 border border-blue-800/50' },
  dual_stakeholder_qol:     { label: 'DUAL QOL',   text: 'text-green-400',  pill: 'bg-green-900/40 text-green-400 border border-green-800/50' },
};

// Short label for leverage types in backlog rows
const LEVERAGE_SHORT = {
  access_unblocking:        { label: 'ACCESS', color: 'text-amber-500' },
  resource_ceiling_removal: { label: 'CEILING', color: 'text-red-400' },
  capability_multiplier:    { label: 'CAPABILITY', color: 'text-purple-400' },
  ecosystem_accelerator:    { label: 'ECOSYSTEM', color: 'text-blue-400' },
  dual_stakeholder_qol:     { label: 'QOL', color: 'text-green-500' },
};

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAccountAbbrev(name) {
  if (!name) return '';
  const abbrevs = {
    'Digital Sanctum HQ': 'DSHQ',
  };
  return abbrevs[name] || name.split(' ').map(w => w[0]).join('').toUpperCase();
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
      className="bg-slate-800 border border-slate-700 p-3 rounded h-[120px] flex flex-col justify-between hover:border-slate-600 cursor-pointer transition-all"
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-bold text-slate-50">{project.name}</h4>
          <p className="text-[11px] text-slate-400">
            Agent: {project._agent || 'Unassigned'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-green-500 font-mono">{score}</span>
          <span className="text-[10px] text-slate-500">/125</span>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {leverageTypes.map(type => {
          const cfg = LEVERAGE_TYPES[type];
          if (!cfg) return null;
          return (
            <span key={type} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cfg.pill}`}>
              {cfg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: In-flight table row
// ---------------------------------------------------------------------------
export function InFlightRow({ project, onNavigate }) {
  const m = computeMetrics(project);

  return (
    <tr
      onClick={() => onNavigate(project.id)}
      className="hover:bg-slate-800 transition-colors cursor-pointer"
    >
      <td className="px-4 py-2.5 font-medium text-slate-200">{project.name}</td>
      <td className="px-4 py-2.5 text-slate-400">{project.account_name}</td>
      <td className="px-4 py-2.5">
        <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
          <div className="bg-indigo-500 h-full" style={{ width: `${m.completionPct}%` }} />
        </div>
        <span className="text-[10px] text-indigo-400 mt-1 block">{m.completionPct}%</span>
      </td>
      <td className="px-4 py-2.5 text-center text-slate-400">{m.remainingTickets}</td>
      <td className="px-4 py-2.5 text-right font-medium text-slate-300">
        {formatShortDate(project.due_date)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Backlog row — compact with factor dots
// ---------------------------------------------------------------------------

function scoreColor(score) {
  if (score >= 90) return 'text-green-500';
  return 'text-amber-500';
}

function barColor(score) {
  if (score >= 90) return 'bg-green-500';
  return 'bg-amber-500';
}

function FactorDots({ analysis }) {
  if (!analysis) return null;
  const factors = Object.values(analysis.factors);
  return (
    <div className="flex gap-0.5 ml-4">
      {factors.map(f => (
        <span
          key={f.abbrev}
          className={`w-2 h-2 rounded-full ${f.score > 0 ? 'bg-indigo-500' : 'bg-slate-600'}`}
          title={f.label}
        />
      ))}
    </div>
  );
}

export function BacklogRow({ project, analysis, onNavigate }) {
  const score = analysis?.total || 0;
  const pct = Math.round((score / 125) * 100);
  const leverageTypes = project.leverage_data?.types || [];

  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="flex items-center justify-between bg-slate-800 border border-slate-700/50 px-4 py-1.5 hover:border-slate-600 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4 flex-1">
        <span className="w-24 text-slate-200 font-medium truncate">{project.name}</span>
        <div className="flex items-center gap-2">
          <span className={`${scoreColor(score)} font-bold text-xs w-12`}>{score}/125</span>
          <div className="w-20 bg-slate-700 h-1 rounded-full overflow-hidden">
            <div className={`${barColor(score)} h-full`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <FactorDots analysis={analysis} />
      </div>
      <div className="flex items-center gap-3">
        {leverageTypes.map((type, i) => {
          const cfg = LEVERAGE_SHORT[type];
          if (!cfg) return null;
          return (
            <span key={type} className={`text-[10px] font-bold ${cfg.color}`}>
              {i > 0 ? '+ ' : ''}{cfg.label}
            </span>
          );
        })}
        <MoreVertical size={14} className="text-slate-500" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Completed row — muted with checkmark
// ---------------------------------------------------------------------------
export function CompletedRow({ project, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(project.id)}
      className="flex items-center justify-between text-slate-500 text-xs border-b border-slate-800/50 pb-2 hover:text-slate-300 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2">
        <CheckCircle size={14} className="text-green-500/50" />
        <span className="font-medium text-slate-400">{project.name}</span>
      </div>
      <div className="flex gap-4">
        <span className="text-[10px] uppercase font-bold tracking-tighter opacity-50">
          {formatAccountAbbrev(project.account_name)}
        </span>
        <span className="w-16 text-right">{formatShortDate(project.due_date)}</span>
      </div>
    </div>
  );
}
