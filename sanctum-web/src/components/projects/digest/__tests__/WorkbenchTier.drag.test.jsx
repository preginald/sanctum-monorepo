import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ToastProvider } from '../../../../context/ToastContext';

// Capture the onDragEnd passed to DragDropContext so we can drive drops
// directly. @hello-pangea/dnd is not drop-simulatable in jsdom (no DOM
// geometry), so we stub the library and invoke the handler ourselves.
// Using a container object (not a reassigned binding) keeps the
// react-hooks/globals lint rule happy.
const ctx = { onDragEnd: null };

vi.mock('@hello-pangea/dnd', () => {
  const DragDropContext = ({ onDragEnd, children }) => {
    // eslint-disable-next-line react-hooks/immutability -- test-only sink to capture the library callback
    ctx.onDragEnd = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  };
  const Droppable = ({ children }) =>
    children({
      innerRef: () => {},
      droppableProps: {},
      placeholder: null,
    });
  const Draggable = ({ children }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: { style: {} },
        dragHandleProps: { 'data-drag-handle': true },
      },
      { isDragging: false },
    );
  return { DragDropContext, Droppable, Draggable };
});

// Mock WorkbenchCard to a simple surface that does not fetch.
vi.mock('../../WorkbenchCard', () => ({
  default: ({ pin }) => (
    <div data-testid={`card-${pin.project_id}`}>{pin.project_name}</div>
  ),
}));

import WorkbenchTier from '../WorkbenchTier';

const PIN_A = { project_id: 'a', project_name: 'Alpha', project_status: 'active', account_name: 'Acme' };
const PIN_B = { project_id: 'b', project_name: 'Beta', project_status: 'active', account_name: 'Acme' };
const PIN_C = { project_id: 'c', project_name: 'Gamma', project_status: 'active', account_name: 'Acme' };

function renderTier(onReorder) {
  return render(
    <ToastProvider>
      <WorkbenchTier
        pins={[PIN_A, PIN_B, PIN_C]}
        maxPins={6}
        onUnpin={() => {}}
        onNavigate={() => {}}
        onReorder={onReorder}
      />
    </ToastProvider>,
  );
}

describe('WorkbenchTier — onDragEnd handler', () => {
  beforeEach(() => { ctx.onDragEnd = null; });

  // AC #8: Dragging index 0 to index 2 calls onReorder with [B, C, A].
  it('drop from index 0 to index 2 calls onReorder with [B, C, A]', async () => {
    const onReorder = vi.fn(() => Promise.resolve());
    renderTier(onReorder);

    expect(ctx.onDragEnd).toBeTypeOf('function');

    await act(async () => {
      await ctx.onDragEnd({
        source: { index: 0, droppableId: 'workbench-pins' },
        destination: { index: 2, droppableId: 'workbench-pins' },
        draggableId: 'a',
        reason: 'DROP',
      });
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.calls[0][0].map(p => p.project_id)).toEqual(['b', 'c', 'a']);
  });

  // AC #10: same-index drop is a no-op (guarded in handleDragEnd).
  it('same-index drop does not call onReorder', async () => {
    const onReorder = vi.fn(() => Promise.resolve());
    renderTier(onReorder);

    await act(async () => {
      await ctx.onDragEnd({
        source: { index: 1, droppableId: 'workbench-pins' },
        destination: { index: 1, droppableId: 'workbench-pins' },
        draggableId: 'b',
        reason: 'DROP',
      });
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  // Drop with no destination (cancelled drag) is a no-op.
  it('null-destination drop does not call onReorder', async () => {
    const onReorder = vi.fn(() => Promise.resolve());
    renderTier(onReorder);

    await act(async () => {
      await ctx.onDragEnd({
        source: { index: 0, droppableId: 'workbench-pins' },
        destination: null,
        draggableId: 'a',
        reason: 'DROP',
      });
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  // AC #11: Success case emits NO toast.
  it('success path: emits no toast after successful reorder', async () => {
    const onReorder = vi.fn(() => Promise.resolve());
    renderTier(onReorder);

    await act(async () => {
      await ctx.onDragEnd({
        source: { index: 0, droppableId: 'workbench-pins' },
        destination: { index: 1, droppableId: 'workbench-pins' },
        draggableId: 'a',
        reason: 'DROP',
      });
    });

    // Wait a tick and assert no toast text appears anywhere in the DOM.
    await new Promise(r => setTimeout(r, 10));
    expect(screen.queryByText(/Couldn't save new order/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/order saved/i)).not.toBeInTheDocument();
  });

  // AC #12: Failure case emits exactly one toast with the exact copy.
  it('failure path: shows toast with exact copy when onReorder rejects', async () => {
    const onReorder = vi.fn(() => Promise.reject(new Error('boom')));
    renderTier(onReorder);

    await act(async () => {
      await ctx.onDragEnd({
        source: { index: 0, droppableId: 'workbench-pins' },
        destination: { index: 2, droppableId: 'workbench-pins' },
        draggableId: 'a',
        reason: 'DROP',
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't save new order — reverted."),
      ).toBeInTheDocument();
    });
  });
});
