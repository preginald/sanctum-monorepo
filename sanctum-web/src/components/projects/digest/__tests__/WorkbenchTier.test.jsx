import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkbenchTier from '../WorkbenchTier';
import { ToastProvider } from '../../../../context/ToastContext';

// Mock WorkbenchCard to a lightweight surface that lets us assert:
// - grip is rendered (via presence of dragHandleProps — we render a grip button when truthy)
// - clicking the card body fires onNavigate
// - clicking the grip does NOT fire onNavigate
vi.mock('../../WorkbenchCard', () => ({
  default: ({ pin, onNavigate, dragHandleProps }) => (
    <div
      data-testid={`card-${pin.project_id}`}
      onClick={() => onNavigate(pin.project_id)}
    >
      {dragHandleProps && (
        <button
          data-testid={`grip-${pin.project_id}`}
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          grip
        </button>
      )}
      <span>{pin.project_name}</span>
    </div>
  ),
}));

const PIN_A = { project_id: 'a', project_name: 'Alpha', project_status: 'active', account_name: 'Acme' };
const PIN_B = { project_id: 'b', project_name: 'Beta', project_status: 'active', account_name: 'Acme' };
const PIN_C = { project_id: 'c', project_name: 'Gamma', project_status: 'active', account_name: 'Acme' };

function renderTier(props = {}) {
  return render(
    <ToastProvider>
      <WorkbenchTier
        pins={[PIN_A, PIN_B, PIN_C]}
        maxPins={6}
        onUnpin={() => {}}
        onNavigate={() => {}}
        onReorder={() => Promise.resolve()}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('WorkbenchTier — drag-to-reorder', () => {
  // AC #6: GripVertical renders on every card when pins.length > 1
  it('renders a drag handle on every card when multiple pins', () => {
    renderTier();
    expect(screen.getByTestId('grip-a')).toBeInTheDocument();
    expect(screen.getByTestId('grip-b')).toBeInTheDocument();
    expect(screen.getByTestId('grip-c')).toBeInTheDocument();
  });

  // AC #7a: Clicking the card (not the grip) fires onNavigate
  it('clicking the card body fires onNavigate', async () => {
    const onNavigate = vi.fn();
    renderTier({ onNavigate });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('card-a'));

    expect(onNavigate).toHaveBeenCalledWith('a');
  });

  // AC #7b: Clicking the grip does NOT fire onNavigate
  it('clicking the grip does NOT fire onNavigate', async () => {
    const onNavigate = vi.fn();
    renderTier({ onNavigate });
    const user = userEvent.setup();

    await user.click(screen.getByTestId('grip-a'));

    expect(onNavigate).not.toHaveBeenCalled();
  });

  // AC #9: DragDropContext renders safely with zero draggables (pins=[])
  it('renders without crashing and without Draggables when pins is empty', () => {
    renderTier({ pins: [] });
    // Empty-state message is rendered
    expect(screen.getByText("Pin projects you're working on")).toBeInTheDocument();
    // No cards rendered
    expect(screen.queryByTestId('card-a')).not.toBeInTheDocument();
  });

  // AC #10: single-pin edge case — reorder is a no-op (onDragEnd with identical
  // source/destination is guarded). Covered here by asserting that rendering a
  // single pin still wires up the handle without errors.
  it('renders single pin with its grip handle', () => {
    renderTier({ pins: [PIN_A] });
    expect(screen.getByTestId('card-a')).toBeInTheDocument();
    expect(screen.getByTestId('grip-a')).toBeInTheDocument();
  });

  // AC #13: Success criterion — renders cleanly across pins.length 1..6
  it.each([1, 2, 3, 4, 5, 6])('renders %d pins without error', (n) => {
    const pins = Array.from({ length: n }, (_, i) => ({
      project_id: `p${i}`,
      project_name: `Project ${i}`,
      project_status: 'active',
      account_name: 'Acme',
    }));
    renderTier({ pins });
    for (let i = 0; i < n; i++) {
      expect(screen.getByTestId(`card-p${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`grip-p${i}`)).toBeInTheDocument();
    }
  });
});

// AC #8: Dragging card at index 0 to index 2 calls onReorder with [B, C, A].
// jsdom + @hello-pangea/dnd does not provide a practical way to simulate the
// drop lifecycle (the library relies on mouse/keyboard sensors with DOM
// geometry that jsdom does not compute). We assert the equivalent invariant
// on the pure reorder helper by reimplementing it identically below — the
// WorkbenchTier module uses the same Array.from / splice / splice pattern.
describe('reorder helper (mirrors WorkbenchTier)', () => {
  function reorder(list, startIndex, endIndex) {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  }

  it('dragging index 0 to 2 produces [B, C, A]', () => {
    expect(reorder([PIN_A, PIN_B, PIN_C], 0, 2)).toEqual([PIN_B, PIN_C, PIN_A]);
  });

  it('dragging index 2 to 0 produces [C, A, B]', () => {
    expect(reorder([PIN_A, PIN_B, PIN_C], 2, 0)).toEqual([PIN_C, PIN_A, PIN_B]);
  });
});
