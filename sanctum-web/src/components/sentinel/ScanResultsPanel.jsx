import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';

const LAYER_LABELS = {
  l1: 'Website Health',
  l2: 'Search Visibility',
  l3: 'Content-Market Fit',
  l4: 'Conversion Architecture',
  l5: 'Reputation & Trust',
  l6: 'Analytics & Tracking',
};

function getScoreColor(score) {
  if (score >= 7) return 'text-green-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBarColor(score) {
  if (score >= 7) return 'bg-green-500';
  if (score >= 4) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getEffortBadge(effort) {
  const map = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400',
  };
  return map[(effort || '').toLowerCase()] || 'bg-slate-500/20 text-slate-400';
}

function getStatusIcon(status) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="text-green-500 shrink-0" size={16} />;
    case 'warn':
      return <AlertTriangle className="text-yellow-500 shrink-0" size={16} />;
    case 'fail':
      return <AlertCircle className="text-red-500 shrink-0" size={16} />;
    default:
      return <AlertCircle className="text-slate-600 shrink-0" size={16} />;
  }
}

export default function ScanResultsPanel({ results }) {
  const [expandedLayers, setExpandedLayers] = useState({});

  if (!results) return null;

  const { top_actions, layer_scores, findings } = results;

  const toggleLayer = (layer) => {
    setExpandedLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Group findings by layer
  const findingsByLayer = {};
  if (findings) {
    findings.forEach((f) => {
      const layer = f.layer || 'unknown';
      if (!findingsByLayer[layer]) findingsByLayer[layer] = [];
      findingsByLayer[layer].push(f);
    });
  }

  return (
    <div className="space-y-6">
      {/* TOP ACTIONS */}
      {top_actions && top_actions.length > 0 && (
        <div className="border border-sanctum-gold/30 bg-sanctum-gold/5 rounded-xl p-6">
          <h3 className="font-bold text-sm uppercase text-sanctum-gold mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            Top Priority Actions
          </h3>
          <div className="space-y-3">
            {top_actions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
                <span className="text-sanctum-gold font-bold text-lg shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{action.recommendation}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {action.projected_score_impact != null && (
                      <span className="text-xs font-bold text-green-400">
                        +{Number(action.projected_score_impact).toFixed(1)} pts
                      </span>
                    )}
                    {action.effort_label && (
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${getEffortBadge(action.effort_label)}`}>
                        {action.effort_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LAYER BREAKDOWN */}
      {layer_scores && Object.keys(layer_scores).length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-sm uppercase text-slate-400 mb-4">Category Scores</h3>
          <div className="space-y-4">
            {Object.entries(layer_scores).map(([key, layer]) => {
              const score = layer.score ?? 0;
              const label = LAYER_LABELS[key] || layer.name || key;
              const weight = layer.weight != null ? `${Math.round(layer.weight * 100)}%` : null;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300">{label}</span>
                    <div className="flex items-center gap-2">
                      {weight && <span className="text-xs text-slate-500">{weight}</span>}
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                        {Number(score).toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getScoreBarColor(score)}`}
                      style={{ width: `${Math.min(score * 10, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INDIVIDUAL FINDINGS BY LAYER */}
      {Object.keys(findingsByLayer).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-sm uppercase text-slate-400">Detailed Findings</h3>
          {Object.entries(findingsByLayer).map(([layer, layerFindings]) => {
            const isExpanded = expandedLayers[layer];
            const label = LAYER_LABELS[layer] || layer;
            const passCount = layerFindings.filter((f) => f.status === 'pass').length;
            const totalCount = layerFindings.length;

            return (
              <div key={layer} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleLayer(layer)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h4 className="font-bold text-sm uppercase tracking-wide">{label}</h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {passCount}/{totalCount} passed
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-800">
                    {layerFindings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="p-4 border-b border-slate-800 last:border-b-0 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(finding.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-200">{finding.check}</p>
                              {finding.score != null && (
                                <span className={`text-xs font-bold shrink-0 ${getScoreColor(finding.score)}`}>
                                  {Number(finding.score).toFixed(1)}/10
                                </span>
                              )}
                            </div>
                            {finding.finding && (
                              <p className="text-xs text-slate-400 mt-1">{finding.finding}</p>
                            )}
                            {finding.recommendation && finding.status !== 'pass' && (
                              <p className="text-xs text-blue-400 mt-1">{finding.recommendation}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
