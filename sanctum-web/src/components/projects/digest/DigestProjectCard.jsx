import React from 'react';
import { Calendar, DollarSign, Milestone, Hash } from 'lucide-react';

function formatCurrency(value) {
  const n = Number(value);
  if (!n) return null;
  return `$${n.toLocaleString()}`;
}

export default function DigestProjectCard({ project, onNavigate, highlight }) {
  const price = project.quoted_price || project.budget;

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
          {highlight === 'value' && formatCurrency(price) && (
            <span className="flex items-center gap-1 text-sm font-semibold text-green-400">
              <DollarSign size={14} />
              {formatCurrency(price)}
            </span>
          )}
          {highlight === 'momentum' && (
            <span className="flex items-center gap-1 text-sm font-semibold text-blue-400">
              <Milestone size={14} />
              {project.milestone_count || 0} milestones
            </span>
          )}
          {highlight === 'deadline' && project.due_date && (
            <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
              <Calendar size={14} />
              {project.due_date}
            </span>
          )}
          {highlight === 'deadline' && !project.due_date && (
            <span className="text-xs text-slate-600 italic">No deadline</span>
          )}
          {!highlight && project.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              <Calendar size={12} />
              {project.due_date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
