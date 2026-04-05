import React from 'react';

const DIMENSIONS = [
  { key: 'impact', label: 'I' },
  { key: 'confidence', label: 'C' },
  { key: 'ease', label: 'E' },
];

export default function ICEScoreEditor({ projectId, scores, onUpdate }) {
  const current = scores || { impact: 0, confidence: 0, ease: 0 };

  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      {DIMENSIONS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-1 text-xs text-slate-400">
          <span className="font-medium">{label}</span>
          <select
            value={current[key] || 0}
            onChange={e => onUpdate(projectId, key, parseInt(e.target.value, 10))}
            className="bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-white focus:border-sanctum-gold focus:outline-none"
          >
            <option value={0}>-</option>
            {[1, 2, 3, 4, 5].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
