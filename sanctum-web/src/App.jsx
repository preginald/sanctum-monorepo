import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { ToastProvider } from './context/ToastContext';

// --- AUTH PAGES ---
import Login from './Login';
import PortalDashboard from './pages/PortalDashboard';

// --- CORE MODULES ---
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Diagnostics from './pages/Diagnostics';

// --- CRM MODULE ---
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';

// --- STRATEGY MODULE ---
import ProjectIndex from './pages/ProjectIndex';
import ProjectDetail from './pages/ProjectDetail';
import Deals from './pages/Deals';
import DealDetail from './pages/DealDetail';

// --- OPERATIONS MODULE ---
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import AuditIndex from './pages/AuditIndex';
import AuditDetail from './pages/AuditDetail';

// --- FINANCE MODULE ---
import InvoiceDetail from './pages/InvoiceDetail';

// --- CAMPAIGN MODULE ---
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';

// 1. BASIC AUTH GUARD
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// 2. ADMIN GUARD (The Iron Gate)
// If a Client tries to access these routes, bounce them to /portal immediately.
const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'client') {
      return <Navigate to="/portal" replace />;
  }
  return children;
};

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          
          {/* PUBLIC */}
          <Route path="/login" element={<Login />} />
          
          {/* SECURE ZONE */}
          <Route path="/*" element={<ProtectedRoute><Routes>
                  
                  {/* === CLIENT PORTAL === */}
                  {/* This is the ONLY route a 'client' role should see */}
                  <Route path="/portal" element={<PortalDashboard />} />

                  {/* === ADMIN CITADEL (WRAPPED IN ADMIN ROUTE) === */}
                  <Route path="*" element={
                      <AdminRoute>
                          <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/dashboard" element={<Dashboard />} />
                              
                              <Route path="/clients" element={<Clients />} />
                              <Route path="/clients/:id" element={<ClientDetail />} />
                              
                              <Route path="/projects" element={<ProjectIndex />} />
                              <Route path="/projects/:id" element={<ProjectDetail />} />
                              <Route path="/deals" element={<Deals />} />
                              <Route path="/deals/:id" element={<DealDetail />} />
                              
                              <Route path="/tickets" element={<Tickets />} />
                              <Route path="/tickets/:id" element={<TicketDetail />} />
                              <Route path="/audit" element={<AuditIndex />} />
                              <Route path="/audit/new" element={<AuditDetail />} />
                              <Route path="/audit/:id" element={<AuditDetail />} />
                              
                              <Route path="/catalog" element={<Catalog />} />
                              <Route path="/invoices/:id" element={<InvoiceDetail />} />

                              <Route path="/campaigns" element={<Campaigns />} />
                              <Route path="/campaigns/:id" element={<CampaignDetail />} />
                              
                              <Route path="/admin/health" element={<Diagnostics />} />
                          </Routes>
                      </AdminRoute>
                  } />

          </Routes></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
