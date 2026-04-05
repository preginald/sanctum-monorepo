import { describe, it, expect } from 'vitest';
import { buildClientLandscape, scoreFundamentals, fundamentalSort, computeMetrics, dueDateAscComparator } from './projectMetrics';

const ALL_PROJECTS = [
  { id: '1', name: 'Active Big', account_name: 'Acme', status: 'active', budget: 10000, quoted_price: '20000', milestones: [] },
  { id: '2', name: 'Active Small', account_name: 'Beta', status: 'active', budget: 2000, quoted_price: null, milestones: [] },
  { id: '3', name: 'Capture Acme', account_name: 'Acme', status: 'capture', budget: 5000, quoted_price: '8000', milestones: [] },
  { id: '4', name: 'Capture Beta', account_name: 'Beta', status: 'capture', budget: 1000, quoted_price: null, milestones: [] },
  { id: '5', name: 'Capture New', account_name: 'NewCo', status: 'capture', budget: 0, quoted_price: null, milestones: [] },
  { id: '6', name: 'Done Acme', account_name: 'Acme', status: 'completed', budget: 7000, quoted_price: null, milestones: [] },
  { id: '7', name: 'Done Acme 2', account_name: 'Acme', status: 'completed', budget: 3000, quoted_price: null, milestones: [] },
  { id: '8', name: 'Done Beta', account_name: 'Beta', status: 'completed', budget: 4000, quoted_price: null, milestones: [] },
];

describe('buildClientLandscape', () => {
  it('computes per-client metrics from the full project list', () => {
    const landscape = buildClientLandscape(ALL_PROJECTS);

    expect(landscape['Acme'].activeRevenue).toBe(20000);
    expect(landscape['Acme'].activeCount).toBe(1);
    expect(landscape['Acme'].captureCount).toBe(1);
    expect(landscape['Acme'].completedCount).toBe(2);

    expect(landscape['Beta'].activeRevenue).toBe(2000);
    expect(landscape['Beta'].activeCount).toBe(1);
    expect(landscape['Beta'].completedCount).toBe(1);

    expect(landscape['NewCo'].activeCount).toBe(0);
    expect(landscape['NewCo'].captureCount).toBe(1);
    expect(landscape['NewCo'].completedCount).toBe(0);
  });

  it('computes portfolio share as percentage of active revenue', () => {
    const landscape = buildClientLandscape(ALL_PROJECTS);

    // Total active revenue = 20000 + 2000 = 22000
    // Acme = 20000/22000 = 91%
    expect(landscape['Acme'].portfolioShare).toBe(91);
    // Beta = 2000/22000 = 9%
    expect(landscape['Beta'].portfolioShare).toBe(9);
    // NewCo = 0%
    expect(landscape['NewCo'].portfolioShare).toBe(0);
  });
});

describe('scoreFundamentals', () => {
  const landscape = buildClientLandscape(ALL_PROJECTS);

  it('scores Acme capture highest (high revenue weight, engaged, track record)', () => {
    const acme = scoreFundamentals(ALL_PROJECTS[2], landscape['Acme']);
    const beta = scoreFundamentals(ALL_PROJECTS[3], landscape['Beta']);
    const newco = scoreFundamentals(ALL_PROJECTS[4], landscape['NewCo']);

    expect(acme.total).toBeGreaterThan(beta.total);
    expect(beta.total).toBeGreaterThan(newco.total);
  });

  it('returns four scoring factors', () => {
    const result = scoreFundamentals(ALL_PROJECTS[2], landscape['Acme']);
    expect(Object.keys(result.factors)).toHaveLength(4);
    expect(result.factors.revenueWeight).toBeDefined();
    expect(result.factors.engagement).toBeDefined();
    expect(result.factors.revenueScale).toBeDefined();
    expect(result.factors.conversion).toBeDefined();
  });

  it('caps each factor at 25', () => {
    const result = scoreFundamentals(ALL_PROJECTS[2], landscape['Acme']);
    Object.values(result.factors).forEach(f => {
      expect(f.score).toBeLessThanOrEqual(25);
      expect(f.score).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('fundamentalSort', () => {
  it('sorts backlog projects by fundamental score descending', () => {
    const backlog = ALL_PROJECTS.filter(p => p.status === 'capture');
    const sorted = [...backlog].sort(fundamentalSort(ALL_PROJECTS));

    // Acme capture should be first (highest client revenue weight + track record)
    expect(sorted[0].name).toBe('Capture Acme');
    // NewCo capture should be last (no engagement, no revenue, no track record)
    expect(sorted[sorted.length - 1].name).toBe('Capture New');
  });
});

describe('computeMetrics (in-flight technical analysis)', () => {
  it('computes completion percentage from milestone tickets', () => {
    const p = {
      milestones: [
        { tickets: [{ status: 'resolved' }, { status: 'open' }, { status: 'resolved' }] },
        { tickets: [{ status: 'new' }] },
      ],
    };
    const m = computeMetrics(p);
    expect(m.completionPct).toBe(50);
    expect(m.remainingTickets).toBe(2);
  });

  it('returns 0% for projects with no tickets', () => {
    const m = computeMetrics({ milestones: [] });
    expect(m.completionPct).toBe(0);
  });
});

describe('dueDateAscComparator', () => {
  it('sorts by date ascending with nulls last', () => {
    const projects = [
      { name: 'C', due_date: null },
      { name: 'A', due_date: '2026-03-01' },
      { name: 'B', due_date: '2026-06-01' },
    ];
    const sorted = [...projects].sort(dueDateAscComparator);
    expect(sorted.map(p => p.name)).toEqual(['A', 'B', 'C']);
  });
});
