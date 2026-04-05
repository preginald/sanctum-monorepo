import React from 'react';
import { getScoreColor, computeScore } from '../../../utils/iceScoring';

export default function ICEScoreBadge({ scores }) {
  if (!scores || (!scores.impact && !scores.confidence && !scores.ease)) return null;

  const total = computeScore(scores.impact, scores.confidence, scores.ease);
  const colorClass = getScoreColor(total);

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
      ICE {total}
    </span>
  );
}
