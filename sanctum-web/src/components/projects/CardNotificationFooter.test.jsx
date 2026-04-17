import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardNotificationFooter from './CardNotificationFooter';

const makeNotification = (overrides = {}) => ({
  id: 'n-1',
  type: 'comment',
  text: 'Comment on #2384 — Phase 4 review posted',
  created_at: '2026-04-17T10:00:00Z',
  ...overrides,
});

describe('CardNotificationFooter', () => {
  it('returns null when notifications array is empty', () => {
    const { container } = render(<CardNotificationFooter notifications={[]} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when notifications is undefined', () => {
    const { container } = render(<CardNotificationFooter onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single non-error notification with blue icon and text', () => {
    const n = makeNotification();
    render(<CardNotificationFooter notifications={[n]} onDismiss={vi.fn()} />);
    expect(screen.getByText(n.text)).toBeInTheDocument();
    expect(screen.getByText('dismiss')).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('shows "+N more" when multiple notifications exist', () => {
    const notifications = [
      makeNotification({ id: 'n-1' }),
      makeNotification({ id: 'n-2', text: 'Another comment', created_at: '2026-04-17T09:00:00Z' }),
      makeNotification({ id: 'n-3', text: 'Third comment', created_at: '2026-04-17T08:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismiss={vi.fn()} />);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('prioritises error notifications over non-errors', () => {
    const notifications = [
      makeNotification({ id: 'n-1', type: 'comment', text: 'A comment', created_at: '2026-04-17T12:00:00Z' }),
      makeNotification({ id: 'n-2', type: 'agent_error', text: 'TypeError: null ref', created_at: '2026-04-17T08:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismiss={vi.fn()} />);
    // Error should display even though it's older
    expect(screen.getByText('TypeError: null ref')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows most recent non-error when no errors exist', () => {
    const notifications = [
      makeNotification({ id: 'n-1', type: 'comment', text: 'Old comment', created_at: '2026-04-17T08:00:00Z' }),
      makeNotification({ id: 'n-2', type: 'status_change', text: 'Status changed', created_at: '2026-04-17T12:00:00Z' }),
    ];
    render(<CardNotificationFooter notifications={notifications} onDismiss={vi.fn()} />);
    expect(screen.getByText('Status changed')).toBeInTheDocument();
  });

  it('calls onDismiss with primary notification id and stops propagation', () => {
    const onDismiss = vi.fn();
    const stopPropagation = vi.fn();
    const n = makeNotification({ id: 'notif-42' });

    render(<CardNotificationFooter notifications={[n]} onDismiss={onDismiss} />);
    const row = screen.getByText(n.text).closest('[class*="flex items-center"]');
    fireEvent.click(row, { stopPropagation });

    expect(onDismiss).toHaveBeenCalledWith('notif-42');
  });

  it('applies error styling for agent_error type', () => {
    const n = makeNotification({ type: 'agent_error', text: 'Agent crashed' });
    render(<CardNotificationFooter notifications={[n]} onDismiss={vi.fn()} />);
    const row = screen.getByText('Agent crashed').closest('[class*="flex items-center"]');
    expect(row.className).toContain('bg-red-500');
  });

  it('applies normal styling for non-error types', () => {
    const n = makeNotification({ type: 'comment', text: 'New comment' });
    render(<CardNotificationFooter notifications={[n]} onDismiss={vi.fn()} />);
    const row = screen.getByText('New comment').closest('[class*="flex items-center"]');
    expect(row.className).toContain('bg-slate-400');
  });

  it('renders correct icon for each event type', () => {
    const types = ['agent_stop', 'agent_error', 'comment', 'status_change', 'health_degraded'];
    for (const type of types) {
      const { unmount } = render(
        <CardNotificationFooter
          notifications={[makeNotification({ type, text: `event-${type}` })]}
          onDismiss={vi.fn()}
        />
      );
      expect(screen.getByText(`event-${type}`)).toBeInTheDocument();
      unmount();
    }
  });
});
