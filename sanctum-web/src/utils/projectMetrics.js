/**
 * Fundamental analysis for project prioritisation.
 *
 * Technical analysis (ticket completion, milestone progress) applies to
 * in-flight projects. Captured/backlog projects have no execution data —
 * they need fundamental analysis: client context, revenue landscape,
 * strategic positioning.
 */

// ---------------------------------------------------------------------------
// Client landscape analysis
// ---------------------------------------------------------------------------

/**
 * Build a client-level view of the entire project portfolio.
 * Returns a map of account_name → { activeRevenue, activeCount, captureCount,
 * totalRevenue, completedCount, portfolioShare }
 */
export function buildClientLandscape(allProjects) {
  const clients = {};
  let totalActiveRevenue = 0;

  allProjects.forEach(p => {
    const key = p.account_name || 'Unknown';
    if (!clients[key]) {
      clients[key] = { activeRevenue: 0, activeCount: 0, captureCount: 0, totalRevenue: 0, completedCount: 0 };
    }
    const revenue = Number(p.quoted_price || p.budget) || 0;
    clients[key].totalRevenue += revenue;

    if (p.status === 'active') {
      clients[key].activeRevenue += revenue;
      clients[key].activeCount++;
      totalActiveRevenue += revenue;
    } else if (p.status === 'capture' || p.status === 'planning') {
      clients[key].captureCount++;
    } else if (p.status === 'completed') {
      clients[key].completedCount++;
    }
  });

  // Compute portfolio share (% of active revenue this client represents)
  Object.values(clients).forEach(c => {
    c.portfolioShare = totalActiveRevenue > 0
      ? Math.round((c.activeRevenue / totalActiveRevenue) * 100)
      : 0;
  });

  return clients;
}

/**
 * Score a backlog project using fundamental analysis.
 *
 * Factors (each 0–25, total 0–100):
 *
 * 1. Client Revenue Weight — how much of your active revenue comes from
 *    this client? High concentration = high priority to keep them engaged.
 *
 * 2. Client Engagement — clients with active projects are engaged and
 *    likely to convert backlog items. Clients with zero active projects
 *    may be drifting — their backlog items are either urgent (re-engage)
 *    or stale (deprioritise). We treat it as urgent.
 *
 * 3. Project Revenue Scale — the direct revenue potential of this project.
 *
 * 4. Conversion Signal — does this client have a track record of completing
 *    projects? High completed count = they follow through.
 */
export function scoreFundamentals(project, clientData) {
  const c = clientData || { portfolioShare: 0, activeCount: 0, captureCount: 1, totalRevenue: 0, completedCount: 0 };
  const revenue = Number(project.quoted_price || project.budget) || 0;

  // Factor 1: Client revenue weight (0–25)
  // portfolioShare is 0–100%, map to 0–25
  const revenueWeight = Math.min(25, Math.round(c.portfolioShare * 0.25));

  // Factor 2: Client engagement (0–25)
  // Active projects signal engagement. Zero active = re-engagement urgency.
  let engagement;
  if (c.activeCount === 0 && c.completedCount > 0) {
    // Was active, now idle — re-engagement opportunity
    engagement = 20;
  } else if (c.activeCount === 0) {
    // Never active — low signal
    engagement = 5;
  } else {
    // Active — scale by count, cap at 25
    engagement = Math.min(25, c.activeCount * 8);
  }

  // Factor 3: Project revenue scale (0–25)
  // Logarithmic scale: $1k=5, $5k=15, $10k=20, $20k+=25
  let revenueScale = 0;
  if (revenue > 0) {
    revenueScale = Math.min(25, Math.round(Math.log10(revenue) * 7));
  }

  // Factor 4: Conversion signal (0–25)
  // Completed projects prove the client follows through
  const conversion = Math.min(25, c.completedCount * 5);

  const total = revenueWeight + engagement + revenueScale + conversion;

  return {
    total,
    factors: {
      revenueWeight: { score: revenueWeight, label: 'Client revenue weight' },
      engagement: { score: engagement, label: 'Client engagement' },
      revenueScale: { score: revenueScale, label: 'Project revenue' },
      conversion: { score: conversion, label: 'Conversion track record' },
    },
  };
}

/**
 * Sort backlog projects by fundamental score descending.
 */
export function fundamentalSort(allProjects) {
  const landscape = buildClientLandscape(allProjects);

  return (a, b) => {
    const sa = scoreFundamentals(a, landscape[a.account_name]);
    const sb = scoreFundamentals(b, landscape[b.account_name]);
    if (sb.total !== sa.total) return sb.total - sa.total;
    return a.name.localeCompare(b.name);
  };
}

// ---------------------------------------------------------------------------
// In-flight metrics (technical analysis — only valid for active projects)
// ---------------------------------------------------------------------------

export function computeMetrics(project) {
  const milestones = project.milestones || [];
  const milestoneCount = milestones.length || project.milestone_count || 0;

  let totalTickets = 0;
  let resolvedTickets = 0;
  milestones.forEach(ms => {
    const tickets = ms.tickets || [];
    totalTickets += tickets.length;
    resolvedTickets += tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  });

  const completionPct = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
  const remainingTickets = totalTickets - resolvedTickets;
  const revenue = Number(project.quoted_price || project.budget) || 0;

  return {
    completionPct,
    totalTickets,
    resolvedTickets,
    remainingTickets,
    milestoneCount,
    revenue,
  };
}

export function dueDateAscComparator(a, b) {
  if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name);
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}
