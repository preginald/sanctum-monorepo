import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicketBadge from './TicketBadge';

// TicketBadge uses useToast — mock the context
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe('TicketBadge', () => {
  it('renders no pill when status is undefined', () => {
    const { container } = render(<TicketBadge ticketId={100} />);
    // The outer span should exist, but no nested pill span
    const spans = container.querySelectorAll('span');
    // Only the outer badge span, no pill child
    expect(spans.length).toBe(1);
  });

  it('renders pill with text "new" and grey class for status="new"', () => {
    const { container } = render(<TicketBadge ticketId={100} status="new" />);
    const pill = screen.getByText('new');
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('bg-gray-100');
    expect(pill.className).toContain('text-gray-500');
  });

  it('renders abbreviated "impl" for status="implementation" with blue class', () => {
    const { container } = render(<TicketBadge ticketId={100} status="implementation" />);
    const pill = screen.getByText('impl');
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('bg-blue-100');
    expect(pill.className).toContain('text-blue-700');
  });

  it('renders abbreviated "verify" for status="verification" with green class', () => {
    render(<TicketBadge ticketId={100} status="verification" />);
    const pill = screen.getByText('verify');
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain('bg-green-100');
    expect(pill.className).toContain('text-green-700');
  });

  it('renders "recon" with purple class', () => {
    render(<TicketBadge ticketId={100} status="recon" />);
    const pill = screen.getByText('recon');
    expect(pill.className).toContain('bg-purple-100');
    expect(pill.className).toContain('text-purple-700');
  });

  it('renders "pending" with amber class', () => {
    render(<TicketBadge ticketId={100} status="pending" />);
    const pill = screen.getByText('pending');
    expect(pill.className).toContain('bg-amber-100');
    expect(pill.className).toContain('text-amber-700');
  });
});
