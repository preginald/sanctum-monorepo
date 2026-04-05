import React, { useState, useMemo } from 'react';
import DigestSection from './DigestSection';
import DigestProjectCard from './DigestProjectCard';
import useICEScores from '../../../hooks/useICEScores';
import { iceComparator, dueDateAscComparator } from '../../../utils/iceScoring';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;

export default function ProjectDigestView({ projects, onNavigate }) {
  const { scores, updateScore } = useICEScores();
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const { inFlight, backlog, completed } = useMemo(() => {
    const inFlight = projects
      .filter(p => p.status === 'active')
      .sort(dueDateAscComparator);

    const backlog = projects
      .filter(p => p.status === 'capture' || p.status === 'planning')
      .sort(iceComparator(scores));

    const completed = projects
      .filter(p => p.status === 'completed')
      .sort((a, b) => {
        // Most recently completed first (by due_date desc as proxy)
        if (!a.due_date && !b.due_date) return b.name.localeCompare(a.name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      })
      .slice(0, COMPLETED_MAX);

    return { inFlight, backlog, completed };
  }, [projects, scores]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_INITIAL);

  return (
    <div className="max-w-4xl">
      {inFlight.length > 0 && (
        <DigestSection title="In Flight" accent="inflight" count={inFlight.length}>
          {inFlight.map(p => (
            <DigestProjectCard key={p.id} project={p} onNavigate={onNavigate} />
          ))}
        </DigestSection>
      )}

      {backlog.length > 0 && (
        <DigestSection title="Captured / Backlog" accent="backlog" count={backlog.length}>
          {backlog.map(p => (
            <DigestProjectCard
              key={p.id}
              project={p}
              onNavigate={onNavigate}
              showICE
              iceScores={scores[p.id]}
              onICEUpdate={updateScore}
            />
          ))}
        </DigestSection>
      )}

      {completed.length > 0 && (
        <DigestSection title="Recently Completed" accent="completed" count={completed.length}>
          {visibleCompleted.map(p => (
            <DigestProjectCard key={p.id} project={p} onNavigate={onNavigate} />
          ))}
          {completed.length > COMPLETED_INITIAL && (
            <button
              onClick={() => setShowAllCompleted(prev => !prev)}
              className="text-sm text-slate-400 hover:text-sanctum-gold transition-colors mt-2"
            >
              {showAllCompleted ? 'Show fewer' : `Show ${completed.length - COMPLETED_INITIAL} more`}
            </button>
          )}
        </DigestSection>
      )}

      {inFlight.length === 0 && backlog.length === 0 && completed.length === 0 && (
        <p className="text-slate-500 text-center py-12">No projects to display.</p>
      )}
    </div>
  );
}
