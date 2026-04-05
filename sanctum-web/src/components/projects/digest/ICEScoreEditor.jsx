import React from 'react';

const DIMENSIONS = [
  { key: 'impact', label: 'Impact' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'ease', label: 'Ease' },
];

export default function ICEScoreEditor({ projectId, scores, onUpdate }) {
  const current = scores || { impact: 0, confidence: 0, ease: 0 };

  return (
    <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
      {DIMENSIONS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium">{label}</span>
          <select
            value={current[key] || 0}
            onChange={e => onUpdate(projectId, key, parseInt(e.target.value, 10))}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-sanctum-gold focus:outline-none min-w-[3rem]"
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
