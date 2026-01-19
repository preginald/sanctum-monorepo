import { http, HttpResponse } from 'msw';

export const handlers = [
  // 1. Mock the specific ticket request
  http.get('*/tickets', () => {
    return HttpResponse.json([{
      id: 123,
      subject: "Server Outage",
      status: "open",
      priority: "high",
      account_id: 1,
      account_name: "Acme Corp",
      ticket_type: "support",
      related_invoices: [],
      contacts: [], // Ensure this is an array to prevent .map() errors
      articles: []
    }]);
  }),

// Handle the Resolve action (PUT /tickets/:id)
  http.put('*/tickets/:id', async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: Number(params.id),
      status: 'resolved',
      resolution: body.resolution,
      closed_at: body.closed_at || new Date().toISOString(),
      subject: "Server Outage",
      account_name: "Acme Corp",
      // Important: Return empty arrays for these to prevent crash on re-fetch
      related_invoices: [],
      contacts: [],
      articles: []
    });
  }),

  // 2. Mock all secondary data pools used in useEffects
  http.get('*/projects', () => HttpResponse.json([])),
  http.get('*/accounts/:id', () => HttpResponse.json({ contacts: [] })),
  http.get('*/products', () => HttpResponse.json([])),
  http.get('*/articles', () => HttpResponse.json([])),
  
  // 3. Mock comments to prevent the Right Column from crashing
  http.get('*/comments', () => HttpResponse.json([])),
];