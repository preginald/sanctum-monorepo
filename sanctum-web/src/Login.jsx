import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore'; // Adjusted import path to match standard structure
import { AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sessionError, setSessionError] = useState(false);
  const [loading, setLoading] = useState(false); // Added loading state for UX
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();

  // CHECK FOR SESSION EXPIRATION FLAG
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setSessionError(true);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const success = await login(email, password);
    
    if (success) {
      // 1. GET USER ROLE
      // We access the store state directly to see who just logged in
      const user = useAuthStore.getState().user;

      // 2. CLIENT PORTAL FORK
      if (user?.role === 'client') {
          navigate('/portal');
          return;
      }

      // 3. ADMIN / STAFF REDIRECT
      const params = new URLSearchParams(location.search);
      const redirectTarget = params.get('redirect');
      
      if (redirectTarget) {
        navigate(redirectTarget);
      } else {
        navigate('/');
      }
    } else {
      alert("Access Denied.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-screen bg-sanctum-dark">
      {/* LEFT: Branding */}
      <div className="w-1/2 flex flex-col justify-center items-center border-r border-sanctum-gold/20">
        <h1 className="text-4xl font-bold text-white mb-2">Digital Sanctum</h1>
        <p className="text-sanctum-gold tracking-widest uppercase text-sm">Sovereign Architecture</p>
      </div>

      {/* RIGHT: Login Form */}
      <div className="w-1/2 flex flex-col justify-center items-center bg-black/20">
        
        {/* SESSION TIMEOUT ALERT */}
        {sessionError && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded flex items-center gap-3 text-red-200 animate-pulse">
            <AlertCircle size={20} />
            <span>Session timed out. Please authenticate again.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-80 flex flex-col gap-4">
          <input
            type="email"
            placeholder="Identity"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 bg-slate-800 text-white border border-slate-700 rounded focus:border-sanctum-blue outline-none transition-colors"
          />
          <input
            type="password"
            placeholder="Cipher"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 bg-slate-800 text-white border border-slate-700 rounded focus:border-sanctum-blue outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="p-3 bg-sanctum-blue hover:bg-blue-600 text-white font-bold rounded transition-colors flex justify-center items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
    </div>
  );
}