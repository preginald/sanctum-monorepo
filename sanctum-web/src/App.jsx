import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { ToastProvider } from './context/ToastContext';
import GlobalModalManager from './components/GlobalModalManager';

// --- AUTH PAGES ---
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';

// --- PORTAL PAGES ---
import PortalDashboard from './pages/PortalDashboard';
import PortalTicketDetail from './pages/PortalTicketDetail'; 
import PortalAssets from './pages/PortalAssets';
import PortalProjectDetail from './pages/PortalProjectDetail';
import PortalAuditReport from './pages/PortalAuditReport'; // PHASE 60A: Renamed & category-aware
import PortalAssessments from './pages/PortalAssessments'; // PHASE 60A: Assessment catalog
import PortalQuestionnaire from './pages/PortalQuestionnaire';
import PortalQuestionnaireComplete from './pages/PortalQuestionnaireComplete';
import AdminQuestionnaireList from './pages/AdminQuestionnaireList';

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

// --- LIBRARY MODULE ---
import LibraryIndex from './pages/LibraryIndex';
import ArticleDetail from './pages/ArticleDetail';
import ArticleEditor from './pages/ArticleEditor';

// --- AUTOMATION MODULE ---
import AdminAutomationList from './pages/AdminAutomationList';

// --- TIMESHEET MODULE ---
import TimesheetView from './pages/TimesheetView';

// --- PROFILE MODULE ---
import Profile from './pages/Profile';

// --- ANALYTICS MODULE ---
import Analytics from './pages/Analytics';

import NotificationCenter from './pages/NotificationCenter';

// --- ADMIN MODULES ---
import SystemHealth from './pages/SystemHealth';
import AdminUserList from './pages/AdminUserList';


// 1. BASIC AUTH GUARD
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// 2. ADMIN GUARD
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
        <GlobalModalManager /> 
        <Routes>
          
          {/* === PUBLIC ROUTES === */}
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} /> 
          
          {/* === SECURE ZONE === */}
          <Route path="/*" element={<ProtectedRoute><Routes>
                  
                  {/* CLIENT PORTAL (Explicit) */}
                  <Route path="/portal" element={<PortalDashboard />} />
                  <Route path="/portal/assessments" element={<PortalAssessments />} /> {/* PHASE 60A: Assessment catalog */}
                  <Route path="/portal/audit/:category" element={<PortalAuditReport />} /> {/* PHASE 60A: Category-aware */}
                  <Route path="/portal/security" element={<Navigate to="/portal/audit/security" replace />} /> {/* Legacy redirect */}
                  <Route path="/portal/tickets/:id" element={<PortalTicketDetail />} /> 
                  <Route path="/portal/assets" element={<PortalAssets />} />
                  <Route path="/portal/projects/:id" element={<PortalProjectDetail />} />
                  <Route path="/portal/questionnaire" element={<PortalQuestionnaire />} />
                  <Route path="/portal/questionnaire/complete" element={<PortalQuestionnaireComplete />} />
                  {/* ADMIN CITADEL */}
                  <Route path="*" element={
                      <AdminRoute>
                          <Routes>
                              {/* DASHBOARD */}
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/dashboard" element={<Dashboard />} />
                              <Route path="/admin/questionnaires" element={<AdminQuestionnaireList />} />
 
                              {/* CRM */}
                              <Route path="/clients" element={<Clients />} />
                              <Route path="/clients/:id" element={<ClientDetail />} />
                              
                              {/* STRATEGY */}
                              <Route path="/projects" element={<ProjectIndex />} />
                              <Route path="/projects/:id" element={<ProjectDetail />} />
                              <Route path="/deals" element={<Deals />} />
                              <Route path="/deals/:id" element={<DealDetail />} />
                              
                              {/* OPERATIONS */}
                              <Route path="/tickets" element={<Tickets />} />
                              <Route path="/tickets/new" element={<Tickets autoCreate={true} />} /> 
                              <Route path="/tickets/:id" element={<TicketDetail />} />
                              
                              <Route path="/audit" element={<AuditIndex />} />
                              <Route path="/audit/new" element={<AuditDetail />} />
                              <Route path="/audit/:id" element={<AuditDetail />} />
                              
                              <Route path="/catalog" element={<Catalog />} />
                              <Route path="/invoices/:id" element={<InvoiceDetail />} />

                              {/* MARKETING */}
                              <Route path="/campaigns" element={<Campaigns />} />
                              <Route path="/campaigns/:id" element={<CampaignDetail />} />

                              {/* KNOWLEDGE */}
                              <Route path="/wiki" element={<LibraryIndex />} />
                              <Route path="/wiki/new" element={<ArticleEditor />} />
                              <Route path="/wiki/:slug" element={<ArticleDetail />} />
                              <Route path="/wiki/:id/edit" element={<ArticleEditor />} />

                              {/* INTELLIGENCE & AUTOMATION */}
                              <Route path="/admin/automations" element={<AdminAutomationList />} />
                              <Route path="/timesheets" element={<TimesheetView />} />
                              <Route path="/analytics" element={<Analytics />} />

                              {/* USER & SYSTEM */}
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/admin/users" element={<AdminUserList />} />
                              <Route path="/notifications" element={<NotificationCenter />} />

                              {/* DIAGNOSTICS */}
                              <Route path="/admin/health" element={<Diagnostics />} />
                              <Route path="/system/health" element={<SystemHealth />} />
                              
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
