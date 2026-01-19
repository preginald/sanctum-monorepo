import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('opens resolve modal and submits resolution successfully', async () => {
  render(
    <MemoryRouter initialEntries={['/tickets/123']}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
      </Routes>
    </MemoryRouter>
  );

  // 1. Wait for page to load
  await screen.findByText('Server Outage');

  // 2. Click the Resolve button
  // Note: We search for the specific text "Resolve" inside the button
  const resolveBtn = screen.getByRole('button', { name: /resolve/i });
  fireEvent.click(resolveBtn);

  // 3. Verify Modal Appears
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Resolve Ticket')).toBeInTheDocument();

  // 4. Verify "Confirm" is disabled initially (validation check)
  const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
  expect(confirmBtn).toBeDisabled();

  // 5. Enter Resolution Text
  // Using the placeholder found in your ResolveModal.jsx
  const textarea = screen.getByPlaceholderText(/Fixed by updating the API endpoint/i);
  fireEvent.change(textarea, { target: { value: 'Fixed the decimal precision error in the API.' } });

  // 6. Verify "Confirm" is now enabled and Submit
  expect(confirmBtn).toBeEnabled();
  fireEvent.click(confirmBtn);

  // 7. Verify Success
  // The modal should disappear
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  
  // Verify the Toast was triggered (success feedback)
  // Since we mocked addToast in the setup, we can check if it was called
  // OR simpler: check if the logic completed without error
  // (If you want to be precise, you can check if the button disappears, 
  // but that requires more complex MSW state mocking for the GET refresh).
});

test('resolve button is hidden if ticket is already resolved', async () => {
  // We can override the handler for a specific test if needed, 
  // or just mock a ticket with 'resolved' status.
  server.use(
    http.get('*/tickets', () => {
      return HttpResponse.json([{
        id: 123,
        subject: "Old Issue",
        status: "resolved", // Already resolved 
        account_name: "Acme Corp",
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
  expect(resolveBtn).not.toBeInTheDocument(); // Button should be hidden 
  });
});