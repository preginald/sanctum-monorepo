// statusStyles.js — DS-UX-003
// IMPORTANT: All class strings must be complete and unbroken for Tailwind CSS purge detection.
// Do NOT use template literals or string concatenation here.

export const priorityStyles = {
  critical: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
  high:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-amber-500/20 text-amber-400 border-amber-500/30",
  normal:   "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  low:      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export const ticketStatusStyles = {
  new:      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  open:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  pending:  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-amber-500/20 text-amber-400 border-amber-500/30",
  qa:       "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-purple-500/20 text-purple-400 border-purple-500/30",
  resolved: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
};

export const ticketTypeStyles = {
  support:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  bug:         "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
  feature:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  task:        "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  hotfix:      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-orange-500/20 text-orange-400 border-orange-500/30",
  maintenance: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-teal-500/20 text-teal-400 border-teal-500/30",
  refactor:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  access:      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  alert:       "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
  test:        "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export const invoiceStatusStyles = {
  draft:   "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  sent:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  paid:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  overdue: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
};

export const dealStageStyles = {
  Infiltration: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  Accession:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  Negotiation:  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-amber-500/20 text-amber-400 border-amber-500/30",
  'Closed Won': "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  Lost:         "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
};

export const assetStatusStyles = {
  draft:       "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  active:      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  maintenance: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-amber-500/20 text-amber-400 border-amber-500/30",
  storage:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  retired:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-red-500/20 text-red-400 border-red-500/30",
  lost:        "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const clientStatusStyles = {
  active:   "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  inactive: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  prospect: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export const auditStatusStyles = {
  draft:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  active:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  finalized: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
};

export const projectStatusStyles = {
  planning:  "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  active:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  completed: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  on_hold:   "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const campaignStatusStyles = {
  draft:     "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30",
  active:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-green-500/20 text-green-400 border-green-500/30",
  completed: "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-blue-500/20 text-blue-400 border-blue-500/30",
  paused:    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export const fallbackStyle = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-slate-500/20 text-slate-400 border-slate-500/30";
