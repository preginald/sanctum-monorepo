import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import useAuthStore from './store/authStore';
import Clients from './pages/Clients'; // <--- Add import
import ClientDetail from './pages/ClientDetail'; // <--- Import
import Deals from './pages/Deals'; // <--- Import
import DealDetail from './pages/DealDetail'; // <--- Import
import AuditIndex from './pages/AuditIndex';
import AuditDetail from './pages/AuditDetail';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Catalog from './pages/Catalog';
import Diagnostics from './pages/Diagnostics';
import InvoiceDetail from './pages/InvoiceDetail';
import ProjectIndex from './pages/ProjectIndex';
import ProjectDetail from './pages/ProjectDetail';


// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* The Citadel (Protected Area) */}
	  <Route
  	path="/*"
  	element={
    	<ProtectedRoute>
      	<Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} /> {/* <--- Add Route */}
	        <Route path="/clients/:id" element={<ClientDetail />} /> {/* <--- New Route */}
          <Route path="/deals" element={<Deals />} /> {/* <--- Add Route */}
          <Route path="/deals/:id" element={<DealDetail />} />
          <Route path="/audit" element={<AuditIndex />} />
          <Route path="/audit/new" element={<AuditDetail />} />
          <Route path="/audit/:id" element={<AuditDetail />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/catalog" element={<Catalog/>} />
          <Route path="/admin/health" element={<Diagnostics />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/projects" element={<ProjectIndex />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
    </ProtectedRoute>
  }
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
