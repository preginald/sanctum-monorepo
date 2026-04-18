import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardNotificationFooter from './CardNotificationFooter';

const makeNotification = (overrides = {}) => ({
  id: 'n-1',
  event_type: 'comment',
  title: 'Comment on #2384 — Phase 4 review posted',
  created_at: '2026-04-17T10:00:00Z',
  ...overrides,
});

describe('CardNotificationFooter', () => {
  it('returns null when notifications array is empty', () => {
    const { container } = render(<CardNotificationFooter notifications={[]} onDismissAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when notifications is undefined', () => {
    const { container } = render(<CardNotificationFooter onDismissAll={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single non-error notification with blue icon and text', () => {
    const n = makeNotification({ event_type: 'ticket_comment' });
    render(<CardNotificationFooter notifications={[n]} onDismissAll={vi.fn()} />);
    expect(screen.getByText(n.title)).toBeInTheDocument();
    expect(screen.getByText('dismiss')).toBeInTheDocument();
  });

  it('does not render a "+N more" counter even when multiple notifications exist', () => {
    const notifications = [
      makeNotification({ id: 'n-1', event_type: 'ticket_comment' }),
      makeNotification({ id: 'n-2', event_type: 'ticket_comment', title: 'Another comment', created_at: '2026-04-17T09:00:00Z' }),
      makeNotification({ id: 'n-3', event_type: 'ticket_comment', title: 'Third comment', created_at: '2026-04-17T08:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismissAll={vi.fn()} />);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('prioritises error notifications over non-errors', () => {
    const notifications = [
      makeNotification({ id: 'n-1', event_type: 'ticket_comment', title: 'A comment', created_at: '2026-04-17T12:00:00Z' }),
      makeNotification({ id: 'n-2', event_type: 'agent_error', title: 'TypeError: null ref', created_at: '2026-04-17T08:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismissAll={vi.fn()} />);
    expect(screen.getByText('TypeError: null ref')).toBeInTheDocument();
  });

  it('shows most recent non-error when no errors exist', () => {
    const notifications = [
      makeNotification({ id: 'n-1', event_type: 'ticket_comment', title: 'Old comment', created_at: '2026-04-17T08:00:00Z' }),
      makeNotification({ id: 'n-2', event_type: 'ticket_status_change', title: 'Status changed', created_at: '2026-04-17T12:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismissAll={vi.fn()} />);
    expect(screen.getByText('Status changed')).toBeInTheDocument();
  });

  it('calls onDismissAll with every notification id when dismissed', () => {
    const onDismissAll = vi.fn();
    const notifications = [
      makeNotification({ id: 'n-1', event_type: 'ticket_comment', created_at: '2026-04-17T12:00:00Z' }),
      makeNotification({ id: 'n-2', event_type: 'ticket_comment', title: 'Second', created_at: '2026-04-17T10:00:00Z' }),
      makeNotification({ id: 'n-3', event_type: 'ticket_comment', title: 'Third', created_at: '2026-04-17T09:00:00Z' }),
    ];

    render(<CardNotificationFooter notifications={notifications} onDismissAll={onDismissAll} />);
    const row = screen.getByText(notifications[0].title).closest('[class*="flex items-center"]');
    fireEvent.click(row);

    expect(onDismissAll).toHaveBeenCalledTimes(1);
    expect(onDismissAll).toHaveBeenCalledWith(['n-1', 'n-2', 'n-3']);
  });

  it('applies error styling for agent_error type', () => {
    const n = makeNotification({ event_type: 'agent_error', title: 'Agent crashed' });
    render(<CardNotificationFooter notifications={[n]} onDismissAll={vi.fn()} />);
    const row = screen.getByText('Agent crashed').closest('[class*="flex items-center"]');
    expect(row.className).toContain('bg-red-500');
  });

  it('applies normal styling for non-error types', () => {
    const n = makeNotification({ event_type: 'ticket_comment', title: 'New comment' });
    render(<CardNotificationFooter notifications={[n]} onDismissAll={vi.fn()} />);
    const row = screen.getByText('New comment').closest('[class*="flex items-center"]');
    expect(row.className).toContain('bg-slate-400');
  });

  it('renders correct icon for each event type', () => {
    const types = ['agent_stop', 'agent_error', 'ticket_comment', 'ticket_status_change', 'ticket_assigned', 'health_degraded'];
    for (const event_type of types) {
      const { unmount } = render(
        <CardNotificationFooter
          notifications={[makeNotification({ event_type, title: `event-${event_type}` })]}
          onDismissAll={vi.fn()}
        />
      );
      expect(screen.getByText(`event-${event_type}`)).toBeInTheDocument();
      unmount();
    }
  });
});
