import React, { useState, useMemo } from 'react';
import DigestSection from './DigestSection';
import { HeroCard, InFlightRow, BacklogRow, CompletedRow } from './DigestProjectCard';
import { buildClientLandscape, scoreFundamentals, computeMetrics, dueDateAscComparator } from '../../../utils/projectMetrics';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;
const PARALLEL_SET_SIZE = 3;

export default function ProjectDigestView({ projects, onNavigate }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const landscape = useMemo(() => buildClientLandscape(projects), [projects]);

  const { recommended, inFlight, backlog, completed } = useMemo(() => {
    // Score all backlog projects (capture + planning)
    const allBacklog = projects
      .filter(p => p.status === 'capture' || p.status === 'planning')
      .map(p => ({
        ...p,
        _analysis: scoreFundamentals(p, landscape[p.account_name]),
      }))
      .sort((a, b) => {
        if (b._analysis.total !== a._analysis.total) return b._analysis.total - a._analysis.total;
        return a.name.localeCompare(b.name);
      });

    // Recommended Parallel Set: top 3 projects with leverage_data (Factor 5 enriched)
    const enriched = allBacklog.filter(p => p.leverage_data?.score > 0);
    const recommended = enriched.slice(0, PARALLEL_SET_SIZE);
    const recommendedIds = new Set(recommended.map(p => p.id));

    // Remaining backlog (excluding recommended set)
    const backlog = allBacklog.filter(p => !recommendedIds.has(p.id));

    const inFlight = projects
      .filter(p => p.status === 'active')
      .sort(dueDateAscComparator);

    const completed = projects
      .filter(p => p.status === 'completed')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return b.name.localeCompare(a.name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      })
      .slice(0, COMPLETED_MAX);

    return { recommended, inFlight, backlog, completed };
  }, [projects, landscape]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_INITIAL);

  return (
    <div className="max-w-[1200px]">
      {/* Section 1: Recommended Parallel Set */}
      {recommended.length > 0 ? (
        <DigestSection title="Recommended Parallel Set" accent="recommended">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map(p => (
              <HeroCard
                key={p.id}
                project={p}
                analysis={p._analysis}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </DigestSection>
      ) : (
        <DigestSection title="Recommended Parallel Set" accent="recommended">
          <div className="px-4 py-6 bg-slate-800/40 rounded border border-slate-700/30 text-center">
            <p className="text-sm text-slate-500">
              No enriched projects yet. Run enrichment to generate recommendations.
            </p>
          </div>
        </DigestSection>
      )}

      {/* Section 2: In Flight */}
      {inFlight.length > 0 && (
        <DigestSection title="In Flight" accent="inflight">
          <div className="overflow-hidden border border-slate-700/30 rounded">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800/50">
                <tr className="h-8">
                  <th className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Project</th>
                  <th className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Client</th>
                  <th className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</th>
                  <th className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Backlog</th>
                  <th className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {inFlight.map((p, i) => (
                  <InFlightRow key={p.id} project={p} onNavigate={onNavigate} even={i % 2 === 1} />
                ))}
              </tbody>
            </table>
          </div>
        </DigestSection>
      )}

      {/* Section 3: Backlog */}
      {backlog.length > 0 && (
        <DigestSection title="Backlog" accent="backlog">
          <div className="space-y-1.5">
            {backlog.map(p => (
              <BacklogRow
                key={p.id}
                project={p}
                analysis={p._analysis}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </DigestSection>
      )}

      {/* Section 4: Recently Completed (Archive) */}
      {completed.length > 0 && (
        <DigestSection title="Archive" accent="completed" muted>
          <div className="opacity-50 hover:opacity-80 transition-all">
            <div className="divide-y divide-slate-700/20">
              {visibleCompleted.map(p => (
                <CompletedRow key={p.id} project={p} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
          {completed.length > COMPLETED_INITIAL && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setShowAllCompleted(prev => !prev)}
                className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest hover:underline underline-offset-4"
              >
                {showAllCompleted ? 'Show fewer' : `More Archives`}
              </button>
            </div>
          )}
        </DigestSection>
      )}

      {projects.length === 0 && (
        <p className="text-slate-500 text-center py-12">No projects to display.</p>
      )}
    </div>
  );
}
