const STORAGE_KEY = 'sanctum:projects:iceScores';

export function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveScores(scores) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

export function computeScore(impact, confidence, ease) {
  return (impact || 0) + (confidence || 0) + (ease || 0);
}

export function getScoreColor(score) {
  if (score >= 12) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 7) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

/** Sort comparator: ICE score descending, unscored last, then alphabetical by name */
export function iceComparator(scores) {
  return (a, b) => {
    const sa = scores[a.id];
    const sb = scores[b.id];
    const scoreA = sa ? computeScore(sa.impact, sa.confidence, sa.ease) : null;
    const scoreB = sb ? computeScore(sb.impact, sb.confidence, sb.ease) : null;

    // Both unscored — alphabetical
    if (scoreA === null && scoreB === null) return a.name.localeCompare(b.name);
    // Unscored sinks to bottom
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    // Higher score first
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  };
}

/** Sort by due_date ascending, nulls last */
export function dueDateAscComparator(a, b) {
  if (!a.due_date && !b.due_date) return a.name.localeCompare(b.name);
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}
