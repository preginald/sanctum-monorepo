// statusStyles.js — DS-UX-003
// Single source of truth for all status/type/priority badge colours.
// Import the map you need and pass to StatusBadge or use directly.

const base = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border";

export const badgeBase = base;

export const priorityStyles = {
  critical: `${base} bg-red-500/20 text-red-400 border-red-500/30`,
  high:     `${base} bg-amber-500/20 text-amber-400 border-amber-500/30`,
  normal:   `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  low:      `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
};

export const ticketStatusStyles = {
  new:      `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  open:     `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  pending:  `${base} bg-amber-500/20 text-amber-400 border-amber-500/30`,
  qa:       `${base} bg-purple-500/20 text-purple-400 border-purple-500/30`,
  resolved: `${base} bg-green-500/20 text-green-400 border-green-500/30`,
};

export const ticketTypeStyles = {
  support:     `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  bug:         `${base} bg-red-500/20 text-red-400 border-red-500/30`,
  feature:     `${base} bg-indigo-500/20 text-indigo-400 border-indigo-500/30`,
  task:        `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  hotfix:      `${base} bg-orange-500/20 text-orange-400 border-orange-500/30`,
  maintenance: `${base} bg-teal-500/20 text-teal-400 border-teal-500/30`,
  refactor:    `${base} bg-cyan-500/20 text-cyan-400 border-cyan-500/30`,
  access:      `${base} bg-yellow-500/20 text-yellow-400 border-yellow-500/30`,
  alert:       `${base} bg-red-500/20 text-red-400 border-red-500/30`,
  test:        `${base} bg-purple-500/20 text-purple-400 border-purple-500/30`,
};

export const invoiceStatusStyles = {
  draft:   `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  sent:    `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  paid:    `${base} bg-green-500/20 text-green-400 border-green-500/30`,
  overdue: `${base} bg-red-500/20 text-red-400 border-red-500/30`,
};

export const dealStageStyles = {
  Infiltration: `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  Accession:    `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  Negotiation:  `${base} bg-amber-500/20 text-amber-400 border-amber-500/30`,
  'Closed Won': `${base} bg-green-500/20 text-green-400 border-green-500/30`,
  Lost:         `${base} bg-red-500/20 text-red-400 border-red-500/30`,
};

export const assetStatusStyles = {
  draft:       `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  active:      `${base} bg-green-500/20 text-green-400 border-green-500/30`,
  maintenance: `${base} bg-amber-500/20 text-amber-400 border-amber-500/30`,
  storage:     `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  retired:     `${base} bg-red-500/20 text-red-400 border-red-500/30`,
  lost:        `${base} bg-orange-500/20 text-orange-400 border-orange-500/30`,
};

export const clientStatusStyles = {
  active:   `${base} bg-green-500/20 text-green-400 border-green-500/30`,
  inactive: `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  prospect: `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
};

export const auditStatusStyles = {
  draft:     `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`,
  active:    `${base} bg-blue-500/20 text-blue-400 border-blue-500/30`,
  finalized: `${base} bg-green-500/20 text-green-400 border-green-500/30`,
};

// Fallback for unknown values
export const fallbackStyle = `${base} bg-slate-500/20 text-slate-400 border-slate-500/30`;
