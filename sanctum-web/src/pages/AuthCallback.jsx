import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Loader2, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const [error, setError] = useState(null);
  const handleSSOCallback = useAuthStore((state) => state.handleSSOCallback);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const authError = params.get('error');

    if (authError) {
      setError(params.get('error_description') || authError);
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code or state');
      return;
    }

    handleSSOCallback(code, state)
      .then(({ user, redirectTo }) => {
        // Validate redirect target: must be relative path, no protocol
        if (redirectTo && redirectTo.startsWith('/') && !redirectTo.includes('://')) {
          navigate(redirectTo, { replace: true });
        } else {
          navigate(user?.role === 'client' ? '/portal' : '/', { replace: true });
        }
      })
      .catch((err) => {
        console.error('SSO callback failed:', err);
        setError(err.response?.data?.detail || err.message || 'SSO login failed');
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-sanctum-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-white text-lg font-bold mb-2">SSO Login Failed</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block bg-sanctum-blue hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sanctum-dark flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin text-sanctum-gold mx-auto mb-4" size={40} />
        <p className="text-slate-400 text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
}
