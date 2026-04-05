import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDigestView from './ProjectDigestView';

const MOCK_PROJECTS = [
  { id: 'active-1', name: 'Website Rebuild', account_name: 'Acme Corp', status: 'active', due_date: '2026-06-01', budget: 5000, quoted_price: '8000', milestone_count: 3 },
  { id: 'active-2', name: 'API Integration', account_name: 'Beta Inc', status: 'active', due_date: '2026-03-15', budget: 3000, quoted_price: null, milestone_count: 1 },
  { id: 'active-3', name: 'No Deadline Project', account_name: 'Gamma Ltd', status: 'active', due_date: null, budget: 1000, quoted_price: null, milestone_count: 0 },
  { id: 'capture-1', name: 'Mobile App', account_name: 'Acme Corp', status: 'capture', due_date: '2026-09-01', budget: 0, quoted_price: '15000', milestone_count: 5 },
  { id: 'capture-2', name: 'Analytics Dashboard', account_name: 'Beta Inc', status: 'capture', due_date: null, budget: 2000, quoted_price: null, milestone_count: 0 },
  { id: 'planning-1', name: 'Email Migration', account_name: 'Gamma Ltd', status: 'planning', due_date: '2026-07-01', budget: 500, quoted_price: '3000', milestone_count: 2 },
  { id: 'completed-1', name: 'Old Project A', account_name: 'Acme Corp', status: 'completed', due_date: '2026-01-15', budget: 4000, quoted_price: null, milestone_count: 2 },
  { id: 'completed-2', name: 'Old Project B', account_name: 'Beta Inc', status: 'completed', due_date: '2026-02-20', budget: 6000, quoted_price: null, milestone_count: 3 },
  { id: 'completed-3', name: 'Old Project C', account_name: 'Gamma Ltd', status: 'completed', due_date: '2025-12-01', budget: 2000, quoted_price: null, milestone_count: 1 },
  { id: 'completed-4', name: 'Old Project D', account_name: 'Acme Corp', status: 'completed', due_date: '2025-11-01', budget: 1500, quoted_price: null, milestone_count: 0 },
];

describe('ProjectDigestView', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders three sections for projects in different statuses', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    expect(screen.getByText('In Flight')).toBeInTheDocument();
    expect(screen.getByText('Captured / Backlog')).toBeInTheDocument();
    expect(screen.getByText('Recently Completed')).toBeInTheDocument();
  });

  it('sorts In Flight by due_date ascending with nulls last', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const apiIdx = names.indexOf('API Integration');
    const websiteIdx = names.indexOf('Website Rebuild');
    const noDeadlineIdx = names.indexOf('No Deadline Project');

    expect(apiIdx).toBeLessThan(websiteIdx);
    expect(websiteIdx).toBeLessThan(noDeadlineIdx);
  });

  it('shows sort strategy buttons for backlog section', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    expect(screen.getByText('By Value')).toBeInTheDocument();
    expect(screen.getByText('By Momentum')).toBeInTheDocument();
    expect(screen.getByText('By Deadline')).toBeInTheDocument();
  });

  it('defaults to sorting backlog by value (highest first)', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlogNames = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Mobile App ($15k) > Email Migration ($3k) > Analytics Dashboard ($2k)
    expect(backlogNames).toEqual(['Mobile App', 'Email Migration', 'Analytics Dashboard']);
  });

  it('sorts backlog by momentum when strategy is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('By Momentum'));

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlogNames = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Mobile App (5 milestones) > Email Migration (2) > Analytics Dashboard (0)
    expect(backlogNames).toEqual(['Mobile App', 'Email Migration', 'Analytics Dashboard']);
  });

  it('sorts backlog by deadline when strategy is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('By Deadline'));

    const names = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    const backlogNames = names.filter(n => ['Mobile App', 'Email Migration', 'Analytics Dashboard'].includes(n));

    // Email Migration (2026-07-01) > Mobile App (2026-09-01) > Analytics Dashboard (null)
    expect(backlogNames).toEqual(['Email Migration', 'Mobile App', 'Analytics Dashboard']);
  });

  it('shows only 3 completed projects initially with "Show more" toggle', () => {
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    expect(screen.getByText('Old Project B')).toBeInTheDocument();
    expect(screen.getByText(/Show 1 more/)).toBeInTheDocument();
  });

  it('expands completed section when "Show more" is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText(/Show 1 more/));
    expect(screen.getByText('Old Project D')).toBeInTheDocument();
    expect(screen.getByText('Show fewer')).toBeInTheDocument();
  });

  it('navigates when a project card is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    await user.click(screen.getByText('Website Rebuild'));
    expect(mockNavigate).toHaveBeenCalledWith('active-1');
  });

  it('renders empty state when no projects', () => {
    render(<ProjectDigestView projects={[]} onNavigate={mockNavigate} />);
    expect(screen.getByText('No projects to display.')).toBeInTheDocument();
  });

  it('displays all project names after expanding completed', async () => {
    const user = userEvent.setup();
    render(<ProjectDigestView projects={MOCK_PROJECTS} onNavigate={mockNavigate} />);

    const showMore = screen.queryByText(/Show \d+ more/);
    if (showMore) await user.click(showMore);

    MOCK_PROJECTS.forEach(p => {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    });
  });
});
