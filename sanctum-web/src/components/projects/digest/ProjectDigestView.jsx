import React, { useState, useMemo } from 'react';
import { ArrowDownAZ, DollarSign, Milestone, Calendar } from 'lucide-react';
import DigestSection from './DigestSection';
import DigestProjectCard from './DigestProjectCard';
import { dueDateAscComparator } from '../../../utils/iceScoring';

const COMPLETED_INITIAL = 3;
const COMPLETED_MAX = 10;

const SORT_STRATEGIES = [
  { key: 'value', label: 'By Value', icon: DollarSign, highlight: 'value' },
  { key: 'momentum', label: 'By Momentum', icon: Milestone, highlight: 'momentum' },
  { key: 'deadline', label: 'By Deadline', icon: Calendar, highlight: 'deadline' },
];

const SORT_FNS = {
  value: (a, b) => {
    const va = Number(a.quoted_price || a.budget) || 0;
    const vb = Number(b.quoted_price || b.budget) || 0;
    if (vb !== va) return vb - va;
    return a.name.localeCompare(b.name);
  },
  momentum: (a, b) => {
    const ma = a.milestone_count || 0;
    const mb = b.milestone_count || 0;
    if (mb !== ma) return mb - ma;
    return a.name.localeCompare(b.name);
  },
  deadline: (a, b) => {
    if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name);
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  },
};

export default function ProjectDigestView({ projects, onNavigate }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [sortStrategy, setSortStrategy] = useState('value');

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
          <div className="flex items-center gap-1 mb-4">
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
          {backlog.map(p => (
            <DigestProjectCard
              key={p.id}
              project={p}
              onNavigate={onNavigate}
              highlight={activeStrategy.highlight}
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
