/**
 * Compute actionable metrics from project + milestone data.
 */

export function computeMetrics(project) {
  const milestones = project.milestones || [];
  const milestoneCount = milestones.length || project.milestone_count || 0;

  // Ticket counts across all milestones
  let totalTickets = 0;
  let resolvedTickets = 0;
  milestones.forEach(ms => {
    const tickets = ms.tickets || [];
    totalTickets += tickets.length;
    resolvedTickets += tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  });

  const completionPct = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
  const remainingTickets = totalTickets - resolvedTickets;

  // Revenue
  const revenue = Number(project.quoted_price || project.budget) || 0;

  // ROI: revenue per milestone (proxy for revenue per unit of effort)
  const roi = milestoneCount > 0 ? Math.round(revenue / milestoneCount) : 0;

  // Staleness: is there planned work?
  const hasPlannedWork = milestoneCount > 0;

  return {
    completionPct,
    totalTickets,
    resolvedTickets,
    remainingTickets,
    milestoneCount,
    revenue,
    roi,
    hasPlannedWork,
  };
}

/** Quick Wins: highest completion % first, then fewest remaining tickets */
export function quickWinSort(a, b) {
  const ma = computeMetrics(a);
  const mb = computeMetrics(b);
  // Higher completion first
  if (mb.completionPct !== ma.completionPct) return mb.completionPct - ma.completionPct;
  // Fewer remaining tickets first (less work to finish)
  if (ma.remainingTickets !== mb.remainingTickets) return ma.remainingTickets - mb.remainingTickets;
  return a.name.localeCompare(b.name);
}

/** Highest ROI: revenue per milestone descending */
export function roiSort(a, b) {
  const ma = computeMetrics(a);
  const mb = computeMetrics(b);
  if (mb.roi !== ma.roi) return mb.roi - ma.roi;
  if (mb.revenue !== ma.revenue) return mb.revenue - ma.revenue;
  return a.name.localeCompare(b.name);
}

/** Stale / At Risk: no milestones first, then lowest completion, then overdue */
export function staleSort(a, b) {
  const ma = computeMetrics(a);
  const mb = computeMetrics(b);
  // No planned work sinks to top (needs attention)
  if (ma.hasPlannedWork !== mb.hasPlannedWork) return ma.hasPlannedWork ? 1 : -1;
  // Lowest completion first (most stuck)
  if (ma.completionPct !== mb.completionPct) return ma.completionPct - mb.completionPct;
  return a.name.localeCompare(b.name);
}
