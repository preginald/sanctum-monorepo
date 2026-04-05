import React, { useState, useMemo } from 'react';
import { Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import DigestSection from './DigestSection';
import DigestProjectCard from './DigestProjectCard';
import { dueDateAscComparator } from '../../../utils/iceScoring';
import { quickWinSort, roiSort, staleSort } from '../../../utils/projectMetrics';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;

const SORT_STRATEGIES = [
  { key: 'quickwins', label: 'Quick Wins', icon: Zap, description: 'Closest to done — finish these to free capacity' },
  { key: 'roi', label: 'Highest ROI', icon: TrendingUp, description: 'Most revenue per unit of effort' },
  { key: 'stale', label: 'At Risk', icon: AlertTriangle, description: 'Stalled or unplanned — needs attention' },
];

const SORT_FNS = {
  quickwins: quickWinSort,
  roi: roiSort,
  stale: staleSort,
};

export default function ProjectDigestView({ projects, onNavigate }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [sortStrategy, setSortStrategy] = useState('quickwins');

  const { inFlight, backlog, completed } = useMemo(() => {
    const inFlight = projects
      .filter(p => p.status === 'active')
      .sort(dueDateAscComparator);

    const backlog = projects
      .filter(p => p.status === 'capture' || p.status === 'planning')
      .sort(SORT_FNS[sortStrategy]);

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
  }, [projects, sortStrategy]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_INITIAL);
  const activeStrategy = SORT_STRATEGIES.find(s => s.key === sortStrategy);

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
          <div className="mb-4">
            <div className="flex items-center gap-1 mb-2">
              {SORT_STRATEGIES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSortStrategy(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sortStrategy === key
                      ? 'bg-slate-700 text-white border border-slate-600'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 italic">{activeStrategy.description}</p>
          </div>
          {backlog.map(p => (
            <DigestProjectCard
              key={p.id}
              project={p}
              onNavigate={onNavigate}
              strategy={sortStrategy}
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
