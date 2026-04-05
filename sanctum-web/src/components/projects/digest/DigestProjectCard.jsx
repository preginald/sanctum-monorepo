import React from 'react';
import { Calendar, Briefcase } from 'lucide-react';
import ICEScoreBadge from './ICEScoreBadge';
import ICEScoreEditor from './ICEScoreEditor';

export default function DigestProjectCard({ project, onNavigate, iceScores, onICEUpdate, showICE = false }) {
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
        <div className="flex items-center gap-2 shrink-0">
          {showICE && <ICEScoreBadge scores={iceScores} />}
          {project.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
              <Calendar size={12} />
              {project.due_date}
            </span>
          )}
        </div>
      </div>

      {showICE && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <ICEScoreEditor
            projectId={project.id}
            scores={iceScores}
            onUpdate={onICEUpdate}
          />
        </div>
      )}
    </div>
  );
}
