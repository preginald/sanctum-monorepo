import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TicketDetail from './TicketDetail';
import { vi } from 'vitest';

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() })
}));

describe('TicketDetail Layout Integrity', () => {
  test('renders the 3-column grid and sidebar correctly', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/tickets/123']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for the ticket data to load
    const subject = await screen.findByText('Server Outage');
    expect(subject).toBeInTheDocument();

    // Verify the grid layout classes are present
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('lg:grid-cols-3');

    // Verify the sidebar (Right Column) is present
    // TicketDetail.jsx defines this as a div with h-[600px] 
    const sidebar = container.querySelector('.h-\\[600px\\]');
    expect(sidebar).toBeInTheDocument();
  });
});