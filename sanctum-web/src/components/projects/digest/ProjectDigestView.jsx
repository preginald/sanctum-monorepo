import React, { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { HeroCard, InFlightRow, BacklogRow, CompletedRow } from './DigestProjectCard';
import { buildClientLandscape, scoreFundamentals, dueDateAscComparator } from '../../../utils/projectMetrics';

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
    <div className="max-w-[1200px] space-y-4">
      {/* Section 1: Recommended Parallel Set */}
      <section className="border-l-4 border-indigo-500 bg-slate-800/30 p-4 rounded-r-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-indigo-400" />
          <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-indigo-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Recommended Parallel Set
          </h3>
        </div>
        {recommended.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map(p => (
              <HeroCard key={p.id} project={p} analysis={p._analysis} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 bg-slate-800/40 rounded border border-slate-700/30 text-center">
            <p className="text-sm text-slate-500">
              No enriched projects yet. Run enrichment to generate recommendations.
            </p>
          </div>
        )}
      </section>

      {/* Section 2: In Flight */}
      {inFlight.length > 0 && (
        <section className="bg-slate-800/50 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/80">
            <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-slate-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              In Flight
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-[10px] uppercase text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium w-48">Progress</th>
                  <th className="px-4 py-2 font-medium text-center">Remaining</th>
                  <th className="px-4 py-2 font-medium text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inFlight.map(p => (
                  <InFlightRow key={p.id} project={p} onNavigate={onNavigate} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3: Backlog */}
      {backlog.length > 0 && (
        <section className="space-y-1">
          <div className="px-1 mb-2">
            <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-slate-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Backlog
            </h3>
          </div>
          <div className="space-y-[1px]">
            {backlog.map(p => (
              <BacklogRow key={p.id} project={p} analysis={p._analysis} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Recently Completed */}
      {completed.length > 0 && (
        <section className="bg-slate-900/40 p-4 border border-slate-800 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-slate-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Recently Completed
            </h3>
            {completed.length > COMPLETED_INITIAL && (
              <button
                onClick={() => setShowAllCompleted(prev => !prev)}
                className="text-[10px] text-indigo-400 hover:underline uppercase font-bold tracking-widest"
              >
                {showAllCompleted ? 'Show fewer' : 'Show more'}
              </button>
            )}
          </div>
          <div className="space-y-3">
            {visibleCompleted.map(p => (
              <CompletedRow key={p.id} project={p} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <p className="text-slate-500 text-center py-12">No projects to display.</p>
      )}
    </div>
  );
}
