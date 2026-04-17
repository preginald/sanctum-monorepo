import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

import useWorkbenchNotifications from './useWorkbenchNotifications';

const MOCK_NOTIFICATIONS = {
  notifications: [
    { id: 'n1', title: 'Status Change', message: 'Ticket moved', link: '/tickets/1', is_read: false, created_at: new Date().toISOString(), event_type: 'ticket_status_change', event_payload: {}, project_id: 'proj-1', priority: 'normal' },
    { id: 'n2', title: 'New Comment', message: 'Someone commented', link: '/tickets/2', is_read: false, created_at: new Date().toISOString(), event_type: 'ticket_comment', event_payload: {}, project_id: 'proj-1', priority: 'normal' },
  ],
  unread_count: 2,
};

describe('useWorkbenchNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(
      http.get('*/workbench/notifications', () => HttpResponse.json(MOCK_NOTIFICATIONS)),
      http.put('*/notifications/:id/read', () => HttpResponse.json({ status: 'updated' })),
      http.put('*/notifications/read-all', () => HttpResponse.json({ status: 'all_updated' })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls endpoint every 30s', async () => {
    let callCount = 0;
    server.use(
      http.get('*/workbench/notifications', () => {
        callCount++;
        return HttpResponse.json({ notifications: [], unread_count: 0 });
      }),
    );

    const { result } = renderHook(() => useWorkbenchNotifications());

    // Initial fetch
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
    const initialCount = callCount;

    // Advance 30s
    await act(async () => { vi.advanceTimersByTime(30000); });
    await waitFor(() => expect(callCount).toBeGreaterThan(initialCount));
  });

  it('badge count matches unread_count from API', async () => {
    const { result } = renderHook(() => useWorkbenchNotifications());

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    expect(result.current.notifications).toHaveLength(2);
  });

  it('markRead calls PUT endpoint and removes item from local state', async () => {
    const { result } = renderHook(() => useWorkbenchNotifications());

    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markRead('n1');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBe('n2');
    expect(result.current.unreadCount).toBe(1);
  });

  it('cleanup stops polling on unmount', async () => {
    let callCount = 0;
    server.use(
      http.get('*/workbench/notifications', () => {
        callCount++;
        return HttpResponse.json({ notifications: [], unread_count: 0 });
      }),
    );

    const { unmount } = renderHook(() => useWorkbenchNotifications());

    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1));
    const countAtUnmount = callCount;
    unmount();

    // Advance timers — should NOT trigger more calls
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(callCount).toBe(countAtUnmount);
  });
});
