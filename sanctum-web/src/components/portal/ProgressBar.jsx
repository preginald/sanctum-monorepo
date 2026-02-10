import React from 'react';

/**
 * ProgressBar - Visual score/progress indicator
 * 
 * Used for: Health scores, completion percentages, audit scores
 */
export default function ProgressBar({ 
  score, 
  maxScore = 100,
  height = 'h-2',
  showLabel = false,
  labelPosition = 'top', // 'top', 'bottom', 'inline'
  animated = false,
  colorMode = 'score' // 'score', 'gradient', 'single'
}) {
  const percentage = Math.min((score / maxScore) * 100, 100);

  // Color based on score thresholds
  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Determine bar color
  let barColor = 'bg-blue-500';
  if (colorMode === 'score') {
    barColor = getScoreColor(score);
  } else if (colorMode === 'gradient') {
    barColor = 'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500';
  }

  const label = (
    <div className={`flex items-center justify-between text-sm ${getScoreTextColor(score)}`}>
      <span className="font-bold">{score} / {maxScore}</span>
      <span className="opacity-70">{percentage.toFixed(0)}%</span>
    </div>
  );

  return (
    <div className="w-full">
      {/* Top Label */}
      {showLabel && labelPosition === 'top' && (
        <div className="mb-2">{label}</div>
      )}

      {/* Progress Bar */}
      <div className={`w-full bg-white/10 rounded-full overflow-hidden ${height}`}>
        <div
          className={`${height} ${barColor} rounded-full transition-all duration-500 ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Bottom Label */}
      {showLabel && labelPosition === 'bottom' && (
        <div className="mt-2">{label}</div>
      )}

      {/* Inline Label (overlaid on bar) */}
      {showLabel && labelPosition === 'inline' && (
        <div className="relative -mt-6 px-2">
          <div className="text-xs font-bold text-white drop-shadow">
            {score}/{maxScore}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ScoreDisplay - Large score with progress bar
 * 
 * Commonly used format: big number + small bar underneath
 */
export function ScoreDisplay({ score, maxScore = 100, isNaked = false }) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const theme = {
    textMain: isNaked ? 'text-slate-900' : 'text-white'
  };

  return (
    <div>
      {/* Large Score */}
      <div className="flex items-end gap-2 mb-2">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className={`text-xl opacity-30 mb-1 ${theme.textMain}`}>
          / {maxScore}
        </span>
      </div>

      {/* Progress Bar */}
      <ProgressBar 
        score={score} 
        maxScore={maxScore}
        colorMode="score"
      />
    </div>
  );
}
