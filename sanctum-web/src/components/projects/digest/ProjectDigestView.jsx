import React, { useState, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { HeroCard, InFlightRow, BacklogRow, CompletedRow } from './DigestProjectCard';
import WorkbenchTier from './WorkbenchTier';
import ActiveBacklogTier from './ActiveBacklogTier';
import { buildClientLandscape, scoreFundamentals, dueDateAscComparator } from '../../../utils/projectMetrics';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;
const PARALLEL_SET_SIZE = 3;

export default function ProjectDigestView({
  projects,
  onNavigate,
  pins = [],
  maxPins = 6,
  pinnedIds = new Set(),
  onPin,
  onUnpin,
  onOpenTicket,
  onOpenMilestone,
  onOpenProject,
  notifications = [],
  onMarkNotificationRead,
}) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const landscape = useMemo(() => buildClientLandscape(projects), [projects]);

  const pinDisabled = pinnedIds.size >= maxPins;

  const { recommended, inFlight, backlog, activeBacklog, completed } = useMemo(() => {
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

    // Recommended Parallel Set: top 3 enriched, excluding pinned projects
    const enriched = allBacklog.filter(p => p.leverage_data?.score > 0 && !pinnedIds.has(p.id));
    const recommended = enriched.slice(0, PARALLEL_SET_SIZE);
    const recommendedIds = new Set(recommended.map(p => p.id));

    // Remaining scored backlog (excluding recommended and pinned)
    const backlog = allBacklog.filter(p => !recommendedIds.has(p.id) && !pinnedIds.has(p.id));

    const inFlight = projects
      .filter(p => p.status === 'active')
      .sort(dueDateAscComparator);

    // Active Backlog: active + on_hold projects not already pinned
    const activeBacklog = projects
      .filter(p => (p.status === 'active' || p.status === 'on_hold') && !pinnedIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const completed = projects
      .filter(p => p.status === 'completed')
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return b.name.localeCompare(a.name);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return b.due_date.localeCompare(a.due_date);
      })
      .slice(0, COMPLETED_MAX);

    return { recommended, inFlight, backlog, activeBacklog, completed };
  }, [projects, landscape, pinnedIds]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_INITIAL);

  return (
    <div className="max-w-[1200px] space-y-4">
      {/* Tier 1: Workbench */}
      <WorkbenchTier
        pins={pins}
        maxPins={maxPins}
        onUnpin={onUnpin}
        onNavigate={onNavigate}
        onOpenTicket={onOpenTicket}
        onOpenMilestone={onOpenMilestone}
        onOpenProject={onOpenProject}
        notifications={notifications}
        onMarkNotificationRead={onMarkNotificationRead}
      />

      {/* Tier 2: Recommended Parallel Set */}
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
              <HeroCard
                key={p.id}
                project={p}
                analysis={p._analysis}
                onNavigate={onNavigate}
                pinned={pinnedIds.has(p.id)}
                onPin={onPin}
                pinDisabled={pinDisabled}
              />
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

      {/* Tier 3: Active Backlog */}
      <ActiveBacklogTier
        projects={activeBacklog}
        pinnedIds={pinnedIds}
        pinDisabled={pinDisabled}
        onPin={onPin}
        onNavigate={onNavigate}
      />

      {/* Section: In Flight (unchanged) */}
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

      {/* Section: Scored Backlog (capture/planning, unchanged) */}
      {backlog.length > 0 && (
        <section className="space-y-1">
          <div className="px-1 mb-2">
            <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-slate-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Backlog
            </h3>
          </div>
          <div className="space-y-[1px]">
            {backlog.map(p => (
              <BacklogRow
                key={p.id}
                project={p}
                analysis={p._analysis}
                onNavigate={onNavigate}
                pinned={pinnedIds.has(p.id)}
                onPin={onPin}
                pinDisabled={pinDisabled}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section: Recently Completed (unchanged) */}
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
