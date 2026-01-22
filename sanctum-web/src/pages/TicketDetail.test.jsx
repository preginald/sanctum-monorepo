import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { server } from '../test/server'; 
import { http, HttpResponse } from 'msw';
import TicketDetail from './TicketDetail';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';


// Mock Toast
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() })
}));

describe('TicketDetail Layout Integrity', () => {
  
  it('renders the 3-column grid and sidebar correctly', async () => {
    // Standard Mock for View Test
    server.use(
      http.get('*/tickets', () => {
        return HttpResponse.json([{
          id: 123,
          subject: 'Server Outage',
          status: 'open',
          priority: 'critical',
          description: 'It is down.',
          created_at: '2023-01-01T00:00:00',
          account_id: 'acc-1'
        }]);
      })
    );

    const { container } = render(
      <MemoryRouter initialEntries={['/tickets/123']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Server Outage');
    
    // Verify Grid Class (updated for new layout)
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('xl:grid-cols-5');

    // Verify Sidebar (Right Column) is present by checking for CommentStream container
    // We updated it to be xl:col-span-2 in Phase 34.7
    const sidebar = container.querySelector('.xl\\:col-span-2');
    expect(sidebar).toBeInTheDocument();
  });

it('opens resolve modal and submits resolution successfully', async () => {
    // FORCE TICKET TO BE OPEN
    server.use(
      http.get('*/tickets', () => {
        return HttpResponse.json([{
          id: 123,
          subject: 'Server Outage',
          status: 'open',
          priority: 'critical',
          description: 'It is down.',
          created_at: '2023-01-01T00:00:00',
          account_id: 'acc-1'
        }]);
      })
    );

    render(
      <MemoryRouter initialEntries={['/tickets/123']}>
        <Routes><Route path="/tickets/:id" element={<TicketDetail />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('Server Outage');

    // 1. Click Resolve
    const resolveBtn = screen.getByRole('button', { name: /resolve/i });
    fireEvent.click(resolveBtn);

    // 2. Verify Modal (Increased timeout and specific text query)
    // We look for the HEADER of the modal
    const modalTitle = await screen.findByText('Resolve Ticket', {}, { timeout: 4000 });
    expect(modalTitle).toBeInTheDocument();

    // 3. Enter Text
    const textarea = screen.getByPlaceholderText(/Fixed by/i);
    fireEvent.change(textarea, { target: { value: 'Fixed it.' } });
    
    // 4. Submit
    const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    // 5. Verify Close
    await waitFor(() => expect(screen.queryByText('Resolve Ticket')).not.toBeInTheDocument(), { timeout: 3000 });
  });



  it('resolve button is hidden if ticket is already resolved', async () => {
    // FORCE TICKET TO BE RESOLVED
    server.use(
      http.get('*/tickets', () => {
        return HttpResponse.json([{
          id: 123,
          subject: "Old Issue",
          status: "resolved",
          account_name: "Acme Corp",
          created_at: '2023-01-01T00:00:00',
          account_id: 'acc-1'
        }]);
      })
    );

    render(
      <MemoryRouter initialEntries={['/tickets/123']}>
        <Routes><Route path="/tickets/:id" element={<TicketDetail />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByText('Old Issue');
    const resolveBtn = screen.queryByRole('button', { name: /resolve/i });
    expect(resolveBtn).not.toBeInTheDocument(); 
  });

});