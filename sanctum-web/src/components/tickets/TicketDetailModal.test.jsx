import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import TicketDetailModal from './TicketDetailModal';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const MOCK_TICKET = {
  id: 123,
  subject: 'Fix login timeout',
  status: 'open',
  priority: 'high',
  ticket_type: 'bug',
  description: 'Users are getting logged out after 5 minutes.',
  comments: [{ id: 'c1', body: 'Looking into this' }],
  time_entries: [],
  comment_count: 1,
  total_hours: 0,
};

describe('TicketDetailModal', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    server.use(
      http.get('*/tickets/123', () => HttpResponse.json(MOCK_TICKET)),
    );
  });

  it('renders the ticket subject after loading', async () => {
    render(<TicketDetailModal isOpen={true} onClose={() => {}} ticketId={123} />);
    await waitFor(() => expect(screen.getByText('Fix login timeout')).toBeInTheDocument());
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(<TicketDetailModal isOpen={true} onClose={handleClose} ticketId={123} />);
    await waitFor(() => expect(screen.getByText('Fix login timeout')).toBeInTheDocument());
    // The Modal has an X button — find it by role
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('"Open full page" button navigates to /tickets/123', async () => {
    const handleClose = vi.fn();
    render(<TicketDetailModal isOpen={true} onClose={handleClose} ticketId={123} />);
    await waitFor(() => expect(screen.getByText('Fix login timeout')).toBeInTheDocument());
    const openBtn = screen.getByText('Open full page');
    fireEvent.click(openBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/tickets/123');
  });

  it('does not render content when isOpen is false', () => {
    render(<TicketDetailModal isOpen={false} onClose={() => {}} ticketId={123} />);
    expect(screen.queryByText('Ticket #123')).toBeNull();
  });
});
