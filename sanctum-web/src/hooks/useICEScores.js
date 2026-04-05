import { useState, useCallback } from 'react';
import { loadScores, saveScores, computeScore } from '../utils/iceScoring';

export default function useICEScores() {
  const [scores, setScores] = useState(loadScores);

  const updateScore = useCallback((projectId, dimension, value) => {
    setScores(prev => {
      const current = prev[projectId] || { impact: 0, confidence: 0, ease: 0 };
      const updated = { ...current, [dimension]: value };
      updated.score = computeScore(updated.impact, updated.confidence, updated.ease);
      updated.updated_at = new Date().toISOString();
      const next = { ...prev, [projectId]: updated };
      saveScores(next);
      return next;
    });
  }, []);

  return { scores, updateScore };
}
