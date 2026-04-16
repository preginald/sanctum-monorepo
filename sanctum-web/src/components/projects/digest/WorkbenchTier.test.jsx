import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkbenchTier from './WorkbenchTier';

// WorkbenchCard fetches from API — mock it to avoid network calls
vi.mock('../WorkbenchCard', () => ({
  default: ({ pin }) => <div data-testid="workbench-card">{pin.project_name}</div>,
}));

const MOCK_PINS = [
  { project_id: 'p1', project_name: 'Alpha Project', project_status: 'active', account_name: 'Acme' },
  { project_id: 'p2', project_name: 'Beta Project', project_status: 'active', account_name: 'Acme' },
];

describe('WorkbenchTier', () => {
  const noop = () => {};

  it('renders cards for each pin', () => {
    render(<WorkbenchTier pins={MOCK_PINS} maxPins={6} onUnpin={noop} onNavigate={noop} />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('grid container has md:grid-cols-3 class', () => {
    const { container } = render(
      <WorkbenchTier pins={MOCK_PINS} maxPins={6} onUnpin={noop} onNavigate={noop} />
    );
    const grid = container.querySelector('.grid');
    expect(grid.className).toContain('md:grid-cols-3');
  });

  it('renders counter as 2/6 when 2 pins with maxPins=6', () => {
    render(<WorkbenchTier pins={MOCK_PINS} maxPins={6} onUnpin={noop} onNavigate={noop} />);
    expect(screen.getByText('2/6')).toBeInTheDocument();
  });

  it('shows empty state when no pins', () => {
    render(<WorkbenchTier pins={[]} maxPins={6} onUnpin={noop} onNavigate={noop} />);
    expect(screen.getByText("Pin projects you're working on")).toBeInTheDocument();
  });
});
