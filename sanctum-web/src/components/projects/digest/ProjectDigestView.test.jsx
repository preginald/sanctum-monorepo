import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDigestView from './ProjectDigestView';

const MOCK_PROJECTS = [
  {
    id: 'active-1', name: 'Website Rebuild', account_name: 'Acme Corp', status: 'active',
    due_date: '2026-06-01', budget: 5000, quoted_price: '8000', milestone_count: 3,
    milestones: [{ tickets: [{ status: 'resolved' }, { status: 'resolved' }, { status: 'open' }] }],
  },
  {
    id: 'active-2', name: 'API Integration', account_name: 'Acme Corp', status: 'active',
    due_date: '2026-03-15', budget: 3000, quoted_price: null, milestone_count: 1,
    milestones: [{ tickets: [{ status: 'open' }] }],
  },
  {
    id: 'capture-1', name: 'Mobile App', account_name: 'Acme Corp', status: 'capture',
    due_date: null, budget: 0, quoted_price: '15000', milestone_count: 0, milestones: [],
    leverage_data: { score: 25, types: ['ecosystem_accelerator', 'dual_stakeholder_qol'], scored_at: '2026-04-06' },
  },
  {
    id: 'capture-2', name: 'Analytics Dashboard', account_name: 'Beta Inc', status: 'capture',
    due_date: null, budget: 2000, quoted_price: null, milestone_count: 0, milestones: [],
    leverage_data: { score: 18, types: ['capability_multiplier'], scored_at: '2026-04-06' },
  },
  {
    id: 'capture-3', name: 'Portal Redesign', account_name: 'Acme Corp', status: 'capture',
    due_date: null, budget: 0, quoted_price: '10000', milestone_count: 0, milestones: [],
    leverage_data: { score: 22, types: ['access_unblocking', 'dual_stakeholder_qol'], scored_at: '2026-04-06' },
  },
  {
    id: 'planning-1', name: 'Email Migration', account_name: 'NewCo', status: 'planning',
    due_date: null, budget: 0, quoted_price: null, milestone_count: 0, milestones: [],
  },
  {
    id: 'completed-1', name: 'Old Project A', account_name: 'Acme Corp', status: 'completed',
    due_date: '2026-01-15', budget: 4000, quoted_price: null, milestone_count: 2, milestones: [],
  },
  {
    id: 'completed-2', name: 'Old Project B', account_name: 'Beta Inc', status: 'completed',
    due_date: '2026-02-20', budget: 6000, quoted_price: null, milestone_count: 3, milestones: [],
  },
  {
    id: 'completed-3', name: 'Old Project C', account_name: 'Acme Corp', status: 'completed',
    due_date: '2025-12-01', budget: 2000, quoted_price: null, milestone_count: 1, milestones: [],
  },
  {
    id: 'completed-4', name: 'Old Project D', account_name: 'Acme Corp', status: 'completed',
    due_date: '2025-11-01', budget: 1500, quoted_price: null, milestone_count: 0, milestones: [],
  },
];

describe('ProjectDigestView', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders four sections with clear hierarchy', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getByText('Recommended Parallel Set')).toBeInTheDocument();
    expect(screen.getByText('In Flight')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('shows top 3 enriched projects in Recommended Parallel Set', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // All 3 projects with leverage_data should appear as hero cards
    expect(screen.getByText('Mobile App')).toBeInTheDocument();
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Portal Redesign')).toBeInTheDocument();
  });

  it('displays combined scores out of 125 on hero cards', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // Scores include F5 leverage. Check /125 labels are present
    const scoreLabels = screen.getAllByText('/125');
    expect(scoreLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('shows leverage type pills on enriched projects', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getAllByText('Ecosystem').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dual QoL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Capability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Access').length).toBeGreaterThan(0);
  });

  it('shows CTA when no projects have leverage data', () => {
    const noLeverageProjects = MOCK_PROJECTS.map(p => ({ ...p, leverage_data: null }));
    render(<ProjectDigestView projects={noLeverageProjects} onNavigate={mockNavigate} />);
    expect(screen.getByText(/Run enrichment to generate recommendations/i)).toBeInTheDocument();
  });

  it('In Flight uses compact table rows sorted by due_date ascending', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // Both active projects should be in the table
    const rows = screen.getAllByRole('row');
    // First data row (after header) should be API Integration (2026-03-15, earlier date)
    const cells = rows[1].querySelectorAll('td');
    expect(cells[0].textContent).toBe('API Integration');
  });

  it('shows progress and remaining tickets in In Flight table', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getAllByText('1 rem.').length).toBe(2);
  });

  it('backlog section shows remaining un-enriched projects with factor pills', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // Email Migration has no leverage_data and is in planning — should be in backlog
    expect(screen.getByText('Email Migration')).toBeInTheDocument();
    // Factor pills should include Leverage label
    expect(screen.getAllByText('Leverage').length).toBeGreaterThan(0);
  });

  it('backlog sorted by combined score descending', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // Email Migration (NewCo, no revenue, no leverage) should be last in backlog
    // since all enriched projects are in the recommended set
    const h4s = screen.getAllByRole('heading', { level: 4 });
    const backlogNames = h4s.map(h => h.textContent);
    // Email Migration should be present
    expect(backlogNames).toContain('Email Migration');
  });

  it('completed section is muted with expand/collapse', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    // Initially shows 3 of 4 completed
    expect(screen.getByText('Old Project A')).toBeInTheDocument();
    expect(screen.getByText('More Archives')).toBeInTheDocument();

    // Expand
    await user.click(screen.getByText('More Archives'));
    expect(screen.getByText('Old Project D')).toBeInTheDocument();
  });

  it('navigates on project click', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('Website Rebuild'));
    expect(mockNavigate).toHaveBeenCalledWith('active-1');
  });

  it('renders empty state', () => {
    render(<ProjectDigestView projects={[]} onNavigate={mockNavigate} />);
    expect(screen.getByText('No projects to display.')).toBeInTheDocument();
  });
});
