import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../lib/api'; 
import { AlertCircle, Loader2, Shield, Lock, ArrowLeft, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(''); 
  
  // VIEW STATE: 'login' | '2fa' | 'forgot'
  const [view, setView] = useState('login'); 
  
  const [sessionError, setSessionError] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

  // --- HANDLER: LOGIN SUBMISSION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(email, password, view === '2fa' ? otp : undefined);
      
      if (success) {
          const user = useAuthStore.getState().user;
          
          if (user?.role === 'client') {
             navigate('/portal'); 
             return;
          }

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
      
      if (err.response?.status === 401 && detail === "2FA_REQUIRED") {
          setView('2fa'); 
          setError(''); 
      } else {
          setError('Invalid credentials or server error');
          if (view === '2fa') setView('login');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER: PASSWORD RESET REQUEST ---
  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
        // FIX: Removed '/auth' prefix to match your API structure
        await api.post('/request-reset', { email });
        setSuccessMsg("If an account exists, a reset link has been sent.");
    } catch (err) {
        console.error(err);
        setError("Unable to process request. Please try again later.");
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

        {successMsg && (
            <div className="mb-6 p-3 bg-green-900/20 border border-green-500/50 rounded text-green-200 text-sm text-center">
              {successMsg}
            </div>
        )}

        {/* --- VIEW 1: LOGIN FORM --- */}
        {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-left-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
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
                  <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase">Password</label>
                      <button 
                        type="button" 
                        onClick={() => { setView('forgot'); setError(''); setSuccessMsg(''); }}
                        className="text-xs text-sanctum-gold hover:text-white transition-colors"
                      >
                        Forgot Password?
                      </button>
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-sanctum-gold transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-sanctum-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Authenticate'}
              </button>
            </form>
        )}

        {/* --- VIEW 2: 2FA CHALLENGE --- */}
        {view === '2fa' && (
            <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in slide-in-from-right-4">
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
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sanctum-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Verify & Login'}
                </button>

                <button type="button" onClick={() => { setView('login'); setOtp(''); }} className="text-xs text-slate-500 hover:text-white w-full text-center">
                   Cancel
                </button>
            </form>
        )}

        {/* --- VIEW 3: FORGOT PASSWORD --- */}
        {view === 'forgot' && (
            <form onSubmit={handleResetRequest} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="text-center mb-2">
                    <div className="mx-auto w-12 h-12 bg-sanctum-gold/20 rounded-full flex items-center justify-center text-sanctum-gold mb-2">
                        <Mail size={24} />
                    </div>
                    <h3 className="text-white font-bold">Reset Password</h3>
                    <p className="text-xs text-slate-500">Enter your email to receive a secure link.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
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

                <button
                  type="submit"
                  disabled={loading || successMsg} 
                  className="w-full bg-sanctum-gold hover:bg-yellow-500 text-slate-900 font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
                </button>

                <button 
                  type="button" 
                  onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} 
                  className="flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-white w-full text-center transition-colors"
                >
                   <ArrowLeft size={14} /> Back to Login
                </button>
            </form>
        )}

      </div>
    </div>
  );
}