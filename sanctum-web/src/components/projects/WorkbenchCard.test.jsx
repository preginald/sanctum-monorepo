import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import WorkbenchCard from './WorkbenchCard';

// Mock ToastContext (used by TicketBadge)
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const MOCK_PIN = {
  project_id: 'proj-1',
  project_name: 'Test Project',
  project_status: 'active',
  account_name: 'Acme Corp',
};

const MOCK_SUMMARY = {
  progress: { resolved: 3, total: 10 },
  health: { colour: 'green', tooltip: 'On track' },
  active_milestone: { id: 'ms-1', name: 'Phase 1' },
  current_ticket: { id: 501, subject: 'Build API', status: 'implementation' },
  next_ticket: { id: 502, subject: 'Write tests', status: 'new' },
  last_activity_at: new Date().toISOString(),
};

describe('WorkbenchCard', () => {
  const noop = () => {};

  beforeEach(() => {
    server.use(
      http.get('*/workbench/proj-1/summary', () => HttpResponse.json(MOCK_SUMMARY)),
    );
  });

  it('shows current ticket badge with "impl" pill', async () => {
    render(<WorkbenchCard pin={MOCK_PIN} onUnpin={noop} onNavigate={noop} />);
    await waitFor(() => expect(screen.getByText('impl')).toBeInTheDocument());
  });

  it('next ticket with status "new" has NO status pill', async () => {
    render(<WorkbenchCard pin={MOCK_PIN} onUnpin={noop} onNavigate={noop} />);
    // Wait for summary to load
    await waitFor(() => expect(screen.getByText('Write tests')).toBeInTheDocument());
    // The next_ticket has status "new" which is passed as undefined, so no pill
    // "new" text should not appear as a pill (only "#502" and subject)
    const newPills = screen.queryAllByText('new');
    expect(newPills.length).toBe(0);
  });

  it('next ticket with status "pending" shows pill', async () => {
    server.use(
      http.get('*/workbench/proj-1/summary', () =>
        HttpResponse.json({
          ...MOCK_SUMMARY,
          next_ticket: { id: 502, subject: 'Write tests', status: 'pending' },
        }),
      ),
    );
    render(<WorkbenchCard pin={MOCK_PIN} onUnpin={noop} onNavigate={noop} />);
    await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
  });
});
