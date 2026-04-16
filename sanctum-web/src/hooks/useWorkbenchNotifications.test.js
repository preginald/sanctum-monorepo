import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

// Mock ToastContext
const mockAddToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

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
    vi.useFakeTimers();
    mockAddToast.mockClear();
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

  it('fires toasts for new notification IDs (max 3 per poll)', async () => {
    const manyNotifications = {
      notifications: [
        { id: 'a1', title: 'T1', message: 'M1', link: '/t/1', is_read: false, created_at: new Date().toISOString(), priority: 'normal' },
        { id: 'a2', title: 'T2', message: 'M2', link: '/t/2', is_read: false, created_at: new Date().toISOString(), priority: 'normal' },
        { id: 'a3', title: 'T3', message: 'M3', link: '/t/3', is_read: false, created_at: new Date().toISOString(), priority: 'normal' },
        { id: 'a4', title: 'T4', message: 'M4', link: '/t/4', is_read: false, created_at: new Date().toISOString(), priority: 'normal' },
      ],
      unread_count: 4,
    };
    server.use(
      http.get('*/workbench/notifications', () => HttpResponse.json(manyNotifications)),
    );

    renderHook(() => useWorkbenchNotifications());

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    // Max 3 toasts even though 4 notifications
    expect(mockAddToast).toHaveBeenCalledTimes(3);
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
