import { describe, it, expect } from 'vitest';
import { computeMetrics, quickWinSort, roiSort, staleSort } from './projectMetrics';

const makeProject = (overrides = {}) => ({
  id: 'test',
  name: 'Test',
  status: 'capture',
  budget: 0,
  quoted_price: null,
  milestone_count: 0,
  milestones: [],
  ...overrides,
});

describe('computeMetrics', () => {
  it('computes completion percentage from milestone tickets', () => {
    const p = makeProject({
      milestones: [
        { tickets: [{ status: 'resolved' }, { status: 'open' }, { status: 'resolved' }] },
        { tickets: [{ status: 'new' }] },
      ],
    });
    const m = computeMetrics(p);
    expect(m.completionPct).toBe(50); // 2 of 4
    expect(m.totalTickets).toBe(4);
    expect(m.resolvedTickets).toBe(2);
    expect(m.remainingTickets).toBe(2);
  });

  it('computes ROI as revenue per milestone', () => {
    const p = makeProject({ quoted_price: '10000', milestones: [{}, {}] });
    const m = computeMetrics(p);
    expect(m.roi).toBe(5000);
  });

  it('falls back to budget when quoted_price is null', () => {
    const p = makeProject({ budget: 3000, milestones: [{}] });
    const m = computeMetrics(p);
    expect(m.revenue).toBe(3000);
    expect(m.roi).toBe(3000);
  });

  it('marks projects without milestones as no planned work', () => {
    const m = computeMetrics(makeProject());
    expect(m.hasPlannedWork).toBe(false);
  });
});

describe('quickWinSort', () => {
  it('sorts by completion % descending', () => {
    const almost = makeProject({ name: 'Almost', milestones: [{ tickets: [{ status: 'resolved' }, { status: 'resolved' }, { status: 'open' }] }] });
    const early = makeProject({ name: 'Early', milestones: [{ tickets: [{ status: 'open' }, { status: 'open' }, { status: 'open' }] }] });
    expect([early, almost].sort(quickWinSort).map(p => p.name)).toEqual(['Almost', 'Early']);
  });
});

describe('roiSort', () => {
  it('sorts by revenue per milestone descending', () => {
    const highRoi = makeProject({ name: 'High', quoted_price: '10000', milestones: [{}] }); // $10k/ms
    const lowRoi = makeProject({ name: 'Low', quoted_price: '10000', milestones: [{}, {}, {}, {}] }); // $2.5k/ms
    expect([lowRoi, highRoi].sort(roiSort).map(p => p.name)).toEqual(['High', 'Low']);
  });
});

describe('staleSort', () => {
  it('puts projects with no milestones first', () => {
    const noWork = makeProject({ name: 'Idea' });
    const planned = makeProject({ name: 'Planned', milestones: [{ tickets: [{ status: 'open' }] }] });
    expect([planned, noWork].sort(staleSort).map(p => p.name)).toEqual(['Idea', 'Planned']);
  });
});
