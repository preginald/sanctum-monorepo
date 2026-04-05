import React from 'react';
import { Calendar } from 'lucide-react';

export default function DigestProjectCard({ project, onNavigate }) {
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
        {project.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-500 font-mono shrink-0">
            <Calendar size={12} />
            {project.due_date}
          </span>
        )}
      </div>
    </div>
  );
}
