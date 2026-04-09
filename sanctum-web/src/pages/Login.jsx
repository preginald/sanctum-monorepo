import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { AlertCircle, Loader2, Shield, LogIn } from 'lucide-react';

export default function Login() {
  const [sessionError, setSessionError] = useState(false);
  const [error, setError] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);

  const loginWithSSO = useAuthStore((state) => state.loginWithSSO);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setSessionError(true);
    }
    if (params.get('error') === 'sso_failed') {
      setError('SSO login failed. Please try again.');
    }
  }, [location]);

  const handleSSO = async () => {
    setSsoLoading(true);
    setError('');
    try {
      // Read redirect target from sessionStorage (set by 401 interceptor) or query param
      const redirectTo =
        sessionStorage.getItem('sanctum_redirect') || null;
      sessionStorage.removeItem('sanctum_redirect');
      await loginWithSSO(redirectTo);
    } catch (err) {
      setError('Unable to initiate SSO. Please try again.');
      setSsoLoading(false);
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

        {/* SSO BUTTON */}
        <div className="animate-in fade-in slide-in-from-left-4">
          <button
            type="button"
            onClick={handleSSO}
            disabled={ssoLoading}
            className="w-full bg-sanctum-gold hover:bg-yellow-500 text-slate-900 font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {ssoLoading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Sign in with SSO
          </button>
        </div>

      </div>
    </div>
  );
}
