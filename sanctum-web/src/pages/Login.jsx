import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { AlertCircle, Loader2, Shield, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(''); // NEW: 2FA Code
  const [step, setStep] = useState(1); // NEW: 1=Creds, 2=2FA
  
  const [sessionError, setSessionError] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
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
    setError('');

    try {
      // Pass OTP if in step 2
      const success = await login(email, password, step === 2 ? otp : undefined);
      
      if (success) {
          // --- EXISTING REDIRECT LOGIC ---
          const user = useAuthStore.getState().user;

          // 1. CLIENT PORTAL FORK
          // Check Dashboard Logic: Client view is now handled in Dashboard.jsx via Role Check
          // BUT if you want explicit redirect to /portal (if that route exists separately), keep this.
          // In Phase 39 we made / (Dashboard) smart. So redirecting to / is usually safe now.
          // However, keeping your specific logic:
          if (user?.role === 'client') {
             // If you have a dedicated /portal route, go there. 
             // Otherwise / sends them to the Client Dashboard view automatically.
             navigate('/'); 
             return;
          }

          // 2. ADMIN / STAFF REDIRECT
          const params = new URLSearchParams(location.search);
          const redirectTarget = params.get('redirect');
          
          if (redirectTarget) {
            navigate(redirectTarget);
          } else {
            navigate('/');
          }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      
      // --- NEW: 2FA CHALLENGE ---
      if (err.response?.status === 401 && detail === "2FA_REQUIRED") {
          setStep(2); // Switch to 2FA Input
          setError(''); // Clear credential error
      } else {
          setError('Invalid credentials or server error');
          setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sanctum-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-sanctum-gold to-transparent opacity-50"></div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
             <Shield className="text-sanctum-gold" /> SANCTUM
          </h1>
          <p className="text-slate-500 text-sm uppercase tracking-widest mt-2">Sovereign Architecture</p>
        </div>

        {/* ALERTS */}
        {sessionError && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-500/50 rounded flex items-center gap-3 text-red-200 text-sm animate-pulse">
            <AlertCircle size={18} />
            <span>Session timed out. Re-authenticate.</span>
          </div>
        )}
        
        {error && (
            <div className="mb-6 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-sm text-center">
              {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* STEP 1: CREDENTIALS */}
          {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label> {/* CHANGED */}
                  <input
                    type="email"
                    required
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-sanctum-gold transition-colors"
                    placeholder="operator@sanctum.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Password</label> {/* CHANGED */}
                  <input
                    type="password"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-sanctum-gold transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
          )}

          {/* STEP 2: 2FA */}
          {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="text-center">
                      <div className="mx-auto w-12 h-12 bg-blue-900/20 rounded-full flex items-center justify-center text-blue-400 mb-2">
                          <Lock size={24} />
                      </div>
                      <h3 className="text-white font-bold">Two-Factor Required</h3>
                      <p className="text-xs text-slate-500">Enter the code from your authenticator app.</p>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    required
                    className="w-full bg-slate-800 border border-blue-500 rounded-lg p-3 text-white text-center text-2xl font-mono tracking-[0.5em] focus:outline-none"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                  <button type="button" onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white w-full text-center">Back to Login</button>
              </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sanctum-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : (step === 1 ? 'Authenticate' : 'Verify & Login')}
          </button>
        </form>
      </div>
    </div>
  );
}