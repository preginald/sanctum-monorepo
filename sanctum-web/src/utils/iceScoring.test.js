import { describe, it, expect, beforeEach } from 'vitest';
import { computeScore, getScoreColor, iceComparator, dueDateAscComparator } from './iceScoring';

describe('iceScoring', () => {

  describe('computeScore', () => {
    it('sums impact, confidence, and ease', () => {
      expect(computeScore(3, 4, 5)).toBe(12);
    });

    it('treats falsy values as 0', () => {
      expect(computeScore(0, null, undefined)).toBe(0);
      expect(computeScore(5, 0, 0)).toBe(5);
    });
  });

  describe('getScoreColor', () => {
    it('returns green for scores 12-15', () => {
      expect(getScoreColor(12)).toContain('green');
      expect(getScoreColor(15)).toContain('green');
    });

    it('returns amber for scores 7-11', () => {
      expect(getScoreColor(7)).toContain('amber');
      expect(getScoreColor(11)).toContain('amber');
    });

    it('returns slate for scores below 7', () => {
      expect(getScoreColor(6)).toContain('slate');
      expect(getScoreColor(0)).toContain('slate');
    });
  });

  describe('dueDateAscComparator', () => {
    it('sorts by due_date ascending', () => {
      const projects = [
        { name: 'B', due_date: '2026-06-01' },
        { name: 'A', due_date: '2026-03-01' },
        { name: 'C', due_date: '2026-09-01' },
      ];
      const sorted = [...projects].sort(dueDateAscComparator);
      expect(sorted.map(p => p.name)).toEqual(['A', 'B', 'C']);
    });

    it('puts nulls last', () => {
      const projects = [
        { name: 'No Date', due_date: null },
        { name: 'Has Date', due_date: '2026-01-01' },
      ];
      const sorted = [...projects].sort(dueDateAscComparator);
      expect(sorted[0].name).toBe('Has Date');
      expect(sorted[1].name).toBe('No Date');
    });

    it('sorts alphabetically when both dates are null', () => {
      const projects = [
        { name: 'Zebra', due_date: null },
        { name: 'Alpha', due_date: null },
      ];
      const sorted = [...projects].sort(dueDateAscComparator);
      expect(sorted.map(p => p.name)).toEqual(['Alpha', 'Zebra']);
    });
  });

  describe('iceComparator', () => {
    const scores = {
      'proj-a': { impact: 5, confidence: 5, ease: 5 }, // 15
      'proj-b': { impact: 3, confidence: 2, ease: 2 }, // 7
      // proj-c: unscored
    };

    it('sorts by ICE score descending', () => {
      const projects = [
        { id: 'proj-b', name: 'Low Score' },
        { id: 'proj-a', name: 'High Score' },
      ];
      const sorted = [...projects].sort(iceComparator(scores));
      expect(sorted[0].id).toBe('proj-a');
      expect(sorted[1].id).toBe('proj-b');
    });

    it('puts unscored projects last', () => {
      const projects = [
        { id: 'proj-c', name: 'Unscored' },
        { id: 'proj-b', name: 'Scored' },
      ];
      const sorted = [...projects].sort(iceComparator(scores));
      expect(sorted[0].id).toBe('proj-b');
      expect(sorted[1].id).toBe('proj-c');
    });

    it('sorts unscored projects alphabetically', () => {
      const projects = [
        { id: 'proj-z', name: 'Zebra' },
        { id: 'proj-y', name: 'Alpha' },
      ];
      const sorted = [...projects].sort(iceComparator({}));
      expect(sorted[0].name).toBe('Alpha');
      expect(sorted[1].name).toBe('Zebra');
    });
  });
});
