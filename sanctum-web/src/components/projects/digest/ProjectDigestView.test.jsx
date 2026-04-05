import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDigestView from './ProjectDigestView';

const MOCK_PROJECTS = [
  {
    id: 'active-1', name: 'Website Rebuild', account_name: 'Acme Corp', status: 'active',
    due_date: '2026-06-01', budget: 5000, quoted_price: '8000', milestone_count: 3,
    milestones: [
      { tickets: [{ status: 'resolved' }, { status: 'resolved' }, { status: 'open' }] },
    ],
  },
  {
    id: 'active-2', name: 'API Integration', account_name: 'Beta Inc', status: 'active',
    due_date: '2026-03-15', budget: 3000, quoted_price: null, milestone_count: 1,
    milestones: [{ tickets: [{ status: 'open' }] }],
  },
  {
    id: 'capture-1', name: 'Mobile App', account_name: 'Acme Corp', status: 'capture',
    due_date: null, budget: 0, quoted_price: '15000', milestone_count: 2,
    milestones: [
      { tickets: [{ status: 'resolved' }, { status: 'open' }] },
      { tickets: [{ status: 'open' }] },
    ],
  },
  {
    id: 'capture-2', name: 'Analytics Dashboard', account_name: 'Beta Inc', status: 'capture',
    due_date: null, budget: 2000, quoted_price: null, milestone_count: 0,
    milestones: [],
  },
  {
    id: 'planning-1', name: 'Email Migration', account_name: 'Gamma Ltd', status: 'planning',
    due_date: null, budget: 500, quoted_price: '9000', milestone_count: 1,
    milestones: [{ tickets: [{ status: 'resolved' }, { status: 'resolved' }] }],
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
    id: 'completed-3', name: 'Old Project C', account_name: 'Gamma Ltd', status: 'completed',
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

  it('renders sections for different project statuses', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getByText('In Flight')).toBeInTheDocument();
    expect(screen.getByText('Captured / Backlog')).toBeInTheDocument();
    expect(screen.getByText('Recently Completed')).toBeInTheDocument();
  });

  it('shows three sort strategy buttons', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getByText('Quick Wins')).toBeInTheDocument();
    expect(screen.getByText('Highest ROI')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  it('defaults to Quick Wins — highest completion first', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlog = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Email Migration (100%) > Mobile App (33%) > Analytics Dashboard (0%, no milestones)
    expect(backlog).toEqual(['Email Migration', 'Mobile App', 'Analytics Dashboard']);
  });

  it('switches to Highest ROI sort', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('Highest ROI'));

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlog = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Email Migration ($9k / 1ms = $9k) > Mobile App ($15k / 2ms = $7.5k) > Analytics ($2k / 0ms = $0)
    expect(backlog).toEqual(['Email Migration', 'Mobile App', 'Analytics Dashboard']);
  });

  it('switches to At Risk sort', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('At Risk'));

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlog = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Analytics Dashboard (no milestones) > Mobile App (33%) > Email Migration (100%)
    expect(backlog).toEqual(['Analytics Dashboard', 'Mobile App', 'Email Migration']);
  });

  it('navigates when a project card is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('Website Rebuild'));
    expect(mockNavigate).toHaveBeenCalledWith('active-1');
  });

  it('shows completed collapse/expand', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    expect(screen.getByText(/Show 1 more/)).toBeInTheDocument();
    await user.click(screen.getByText(/Show 1 more/));
    expect(screen.getByText('Old Project D')).toBeInTheDocument();
  });

  it('renders empty state when no projects', () => {
    render(<ProjectDigestView projects={[]} onNavigate={mockNavigate} />);
    expect(screen.getByText('No projects to display.')).toBeInTheDocument();
  });
});
