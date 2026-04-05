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
  },
  {
    id: 'capture-2', name: 'Analytics Dashboard', account_name: 'Beta Inc', status: 'capture',
    due_date: null, budget: 2000, quoted_price: null, milestone_count: 0, milestones: [],
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

  it('renders three sections for different statuses', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getByText('In Flight')).toBeInTheDocument();
    expect(screen.getByText('Captured / Backlog')).toBeInTheDocument();
    expect(screen.getByText('Recently Completed')).toBeInTheDocument();
  });

  it('ranks backlog by fundamental analysis — Acme highest (most revenue weight + track record)', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlog = names.filter(n => ['Mobile App', 'Analytics Dashboard', 'Email Migration'].includes(n));

    // Acme Corp has 2 active projects ($11k revenue) + 3 completed = highest score
    // Mobile App (Acme, $15k) should rank first
    expect(backlog[0]).toBe('Mobile App');
    // NewCo has zero active, zero completed = lowest
    expect(backlog[backlog.length - 1]).toBe('Email Migration');
  });

  it('shows fundamental analysis description', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getByText(/fundamental analysis/i)).toBeInTheDocument();
  });

  it('shows scoring factors on backlog cards', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    expect(screen.getAllByText(/Client revenue weight/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Client engagement/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Conversion track record/i).length).toBeGreaterThan(0);
  });

  it('sorts in-flight by due_date ascending', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const apiIdx = names.indexOf('API Integration');
    const websiteIdx = names.indexOf('Website Rebuild');
    expect(apiIdx).toBeLessThan(websiteIdx);
  });

  it('shows completion bar on in-flight cards with tickets', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);
    // Website Rebuild has 2/3 resolved = 67%, API Integration has 0/1 = 0%
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    // Both have 1 ticket left
    expect(screen.getAllByText('1 ticket left').length).toBe(2);
  });

  it('completed section collapses and expands', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    expect(screen.getByText(/Show 1 more/)).toBeInTheDocument();
    await user.click(screen.getByText(/Show 1 more/));
    expect(screen.getByText('Old Project D')).toBeInTheDocument();
  });

  it('navigates on card click', async () => {
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
