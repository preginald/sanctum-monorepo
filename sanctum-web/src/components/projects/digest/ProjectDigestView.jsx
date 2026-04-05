import React, { useState, useMemo } from 'react';
import DigestSection from './DigestSection';
import { InFlightCard, BacklogCard, CompletedCard } from './DigestProjectCard';
import { buildClientLandscape, scoreFundamentals, dueDateAscComparator } from '../../../utils/projectMetrics';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;

export default function ProjectDigestView({ projects, onNavigate }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const landscape = useMemo(() => buildClientLandscape(projects), [projects]);

  const { inFlight, backlog, completed } = useMemo(() => {
    const inFlight = projects
      .filter(p => p.status === 'active')
      .sort(dueDateAscComparator);

    const backlog = projects
      .filter(p => p.status === 'capture' || p.status === 'planning')
      .map(p => ({
        ...p,
        _analysis: scoreFundamentals(p, landscape[p.account_name]),
      }))
      .sort((a, b) => {
        if (b._analysis.total !== a._analysis.total) return b._analysis.total - a._analysis.total;
        return a.name.localeCompare(b.name);
      });

    const completed = projects
      .filter(p => p.status === 'completed')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return b.name.localeCompare(a.name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      })
      .slice(0, COMPLETED_MAX);

    return { inFlight, backlog, completed };
  }, [projects, landscape]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_INITIAL);

  return (
    <div className="max-w-4xl">
      {inFlight.length > 0 && (
        <DigestSection title="In Flight" accent="inflight" count={inFlight.length}>
          {inFlight.map(p => (
            <InFlightCard key={p.id} project={p} onNavigate={onNavigate} />
          ))}
        </DigestSection>
      )}

      {backlog.length > 0 && (
        <DigestSection title="Captured / Backlog" accent="backlog" count={backlog.length}>
          <p className="text-xs text-slate-500 italic mb-4">
            Ranked by fundamental analysis — client revenue weight, engagement, project scale, and conversion track record
          </p>
          {backlog.map(p => (
            <BacklogCard
              key={p.id}
              project={p}
              onNavigate={onNavigate}
              analysis={p._analysis}
            />
          ))}
        </DigestSection>
      )}

      {completed.length > 0 && (
        <DigestSection title="Recently Completed" accent="completed" count={completed.length}>
          {visibleCompleted.map(p => (
            <CompletedCard key={p.id} project={p} onNavigate={onNavigate} />
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
