import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import useAuthStore from './store/authStore';
import Clients from './pages/Clients'; // <--- Add import
import ClientDetail from './pages/ClientDetail'; // <--- Import



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
        </Routes>
    </ProtectedRoute>
  }
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
