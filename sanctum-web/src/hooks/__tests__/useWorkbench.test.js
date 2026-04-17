import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

import useWorkbench from '../useWorkbench';

const PIN_A = { project_id: 'a', project_name: 'Alpha', project_status: 'active', account_name: 'Acme' };
const PIN_B = { project_id: 'b', project_name: 'Beta', project_status: 'active', account_name: 'Acme' };
const PIN_C = { project_id: 'c', project_name: 'Gamma', project_status: 'active', account_name: 'Acme' };

describe('useWorkbench — reorder', () => {
  beforeEach(() => {
    server.use(
      http.get('*/workbench', () =>
        HttpResponse.json({ pins: [PIN_A, PIN_B, PIN_C], max_pins: 6 }),
      ),
    );
  });

  async function mountHookWithPins() {
    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.pins).toHaveLength(3));
    return result;
  }

  // AC #1: reorderPins sends correct PATCH payload
  it('sends PATCH /workbench/reorder with 0-indexed positions', async () => {
    let captured = null;
    server.use(
      http.patch('*/workbench/reorder', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ status: 'reordered', count: 3 });
      }),
    );

    const result = await mountHookWithPins();

    await act(async () => {
      await result.current.reorderPins([PIN_A, PIN_B, PIN_C]);
    });

    expect(captured).toEqual({
      pin_order: [
        { project_id: 'a', position: 0 },
        { project_id: 'b', position: 1 },
        { project_id: 'c', position: 2 },
      ],
    });
  });

  // AC #2: optimistic update happens before PATCH resolves
  it('updates pins synchronously before PATCH resolves', async () => {
    let resolvePatch;
    server.use(
      http.patch('*/workbench/reorder', () =>
        new Promise((resolve) => {
          resolvePatch = () => resolve(HttpResponse.json({ status: 'reordered', count: 3 }));
        }),
      ),
    );

    const result = await mountHookWithPins();

    let pendingPromise;
    act(() => {
      pendingPromise = result.current.reorderPins([PIN_B, PIN_C, PIN_A]);
    });

    // Optimistic state applied immediately, before PATCH resolves
    await waitFor(() => {
      expect(result.current.pins.map(p => p.project_id)).toEqual(['b', 'c', 'a']);
    });
    expect(result.current.isReordering).toBe(true);

    // Now resolve the PATCH and await completion
    await act(async () => {
      resolvePatch();
      await pendingPromise;
    });

    expect(result.current.isReordering).toBe(false);
    // Optimistic state retained — no refetch
    expect(result.current.pins.map(p => p.project_id)).toEqual(['b', 'c', 'a']);
  });

  // AC #3: on PATCH failure pins revert and the promise rejects
  it('reverts pins to snapshot and rejects on PATCH 500', async () => {
    server.use(
      http.patch('*/workbench/reorder', () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    const result = await mountHookWithPins();
    const before = result.current.pins;

    let rejected = false;
    await act(async () => {
      try {
        await result.current.reorderPins([PIN_C, PIN_B, PIN_A]);
      } catch {
        rejected = true;
      }
    });

    expect(rejected).toBe(true);
    expect(result.current.pins).toEqual(before);
    expect(result.current.isReordering).toBe(false);
  });

  // AC #4: while isReordering is true, pinProject success does NOT refetch
  it('does NOT call fetchPins from pinProject while isReordering is true', async () => {
    let resolvePatch;
    let fetchCount = 0;
    server.use(
      http.get('*/workbench', () => {
        fetchCount += 1;
        return HttpResponse.json({ pins: [PIN_A, PIN_B, PIN_C], max_pins: 6 });
      }),
      http.patch('*/workbench/reorder', () =>
        new Promise((resolve) => {
          resolvePatch = () => resolve(HttpResponse.json({ status: 'reordered', count: 3 }));
        }),
      ),
      http.post('*/workbench/pin', () =>
        HttpResponse.json({ status: 'pinned' }),
      ),
    );

    const { result } = renderHook(() => useWorkbench());
    await waitFor(() => expect(result.current.pins).toHaveLength(3));
    const fetchCountAfterMount = fetchCount;

    // Start a reorder that stays in-flight
    let reorderPromise;
    act(() => {
      reorderPromise = result.current.reorderPins([PIN_B, PIN_C, PIN_A]);
    });
    await waitFor(() => expect(result.current.isReordering).toBe(true));

    // Call pinProject while reorder is in flight — should NOT trigger fetchPins
    await act(async () => {
      await result.current.pinProject('new-project-id');
    });

    expect(fetchCount).toBe(fetchCountAfterMount);

    // Clean up — resolve the patch so nothing leaks
    await act(async () => {
      resolvePatch();
      await reorderPromise;
    });
  });

  // AC #5: while isReordering is true, the 30s poll does NOT refetch
  it('does NOT poll fetchPins while isReordering is true', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolvePatch;
    let fetchCount = 0;
    try {
      server.use(
        http.get('*/workbench', () => {
          fetchCount += 1;
          return HttpResponse.json({ pins: [PIN_A, PIN_B, PIN_C], max_pins: 6 });
        }),
        http.patch('*/workbench/reorder', () =>
          new Promise((resolve) => {
            resolvePatch = () => resolve(HttpResponse.json({ status: 'reordered', count: 3 }));
          }),
        ),
      );

      const { result } = renderHook(() => useWorkbench());
      await waitFor(() => expect(result.current.pins).toHaveLength(3));
      const fetchCountAfterMount = fetchCount;

      // Start a reorder that stays in-flight
      let reorderPromise;
      act(() => {
        reorderPromise = result.current.reorderPins([PIN_B, PIN_C, PIN_A]);
      });
      await waitFor(() => expect(result.current.isReordering).toBe(true));

      // Advance 60s — poll would normally fire at 30s and 60s
      await act(async () => { vi.advanceTimersByTime(60_000); });

      expect(fetchCount).toBe(fetchCountAfterMount);

      // Clean up
      await act(async () => {
        resolvePatch();
        await reorderPromise;
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
