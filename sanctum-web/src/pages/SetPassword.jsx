import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Loader2, Shield, CheckCircle, UserCheck, AlertTriangle, XCircle, Check } from 'lucide-react';

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [userInfo, setUserInfo] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 1. VERIFY TOKEN ON LOAD
  useEffect(() => {
      if (!token) {
          setError("No token provided.");
          setPageLoading(false);
          return;
      }
      
      api.get(`/verify-invite?token=${token}`)
          .then(res => {
              setUserInfo(res.data);
              setPageLoading(false);
          })
          .catch(err => {
              setError(err.response?.data?.detail || "Invalid or expired link.");
              setPageLoading(false);
          });
  }, [token]);

  // 2. REAL-TIME VALIDATION HELPERS
  const isLengthValid = password.length >= 8;
  const isMatchValid = password.length > 0 && password === confirm;
  const canSubmit = isLengthValid && isMatchValid;

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!canSubmit) return;
      
      setError('');
      setLoading(true);
      try {
          await api.post('/set-password', { token, new_password: password });
          setSuccess(true);
          setTimeout(() => navigate('/login'), 3000);
      } catch(e) {
          setError(e.response?.data?.detail || "Failed to set password.");
          setLoading(false);
      }
  };

  if (pageLoading) return (
      <div className="min-h-screen bg-sanctum-dark flex items-center justify-center">
          <Loader2 className="animate-spin text-sanctum-gold" size={48} />
      </div>
  );

  return (
    <div className="min-h-screen bg-sanctum-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-sanctum-gold to-transparent opacity-50"></div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
             <Shield className="text-sanctum-gold" /> SANCTUM
          </h1>
          <p className="text-slate-500 text-sm uppercase tracking-widest mt-2">Account Activation</p>
        </div>

        {success ? (
            <div className="text-center space-y-4 animate-in fade-in">
                <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-white">Access Granted</h2>
                <p className="text-slate-400">Redirecting to login...</p>
            </div>
        ) : error ? (
            <div className="text-center space-y-4 animate-in fade-in">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="text-xl font-bold text-white">Link Expired</h2>
                <p className="text-slate-400">{error}</p>
                <button onClick={() => navigate('/login')} className="text-blue-400 hover:text-blue-300 underline text-sm">Return to Login</button>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* WELCOME BLOCK */}
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg text-center">
                    <UserCheck className="mx-auto text-blue-400 mb-2" size={24} />
                    <h2 className="text-lg font-bold text-white">Hello, {userInfo?.full_name}</h2>
                    <p className="text-xs text-blue-200 mt-1">{userInfo?.email}</p>
                    <p className="text-xs text-slate-400 mt-3 border-t border-blue-500/30 pt-2">Please create a secure password to activate your account.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">New Password</label>
                        <input
                            type="password"
                            required
                            autoFocus
                            className={`w-full bg-slate-800 border rounded-lg p-3 text-white focus:outline-none transition-colors ${
                                password.length > 0 && !isLengthValid 
                                    ? 'border-red-500 focus:border-red-500' 
                                    : 'border-slate-700 focus:border-sanctum-gold'
                            }`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Confirm Password</label>
                        <input
                            type="password"
                            required
                            className={`w-full bg-slate-800 border rounded-lg p-3 text-white focus:outline-none transition-colors ${
                                confirm.length > 0 && !isMatchValid 
                                    ? 'border-red-500 focus:border-red-500' 
                                    : 'border-slate-700 focus:border-sanctum-gold'
                            }`}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>

                    {/* LIVE VALIDATION CHECKLIST */}
                    <div className="space-y-2 pt-2">
                        <div className={`flex items-center gap-2 text-xs transition-colors ${isLengthValid ? 'text-green-500' : 'text-slate-500'}`}>
                            {isLengthValid ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                            <span>At least 8 characters</span>
                        </div>
                        <div className={`flex items-center gap-2 text-xs transition-colors ${isMatchValid ? 'text-green-500' : 'text-slate-500'}`}>
                            {isMatchValid ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />}
                            <span>Passwords match</span>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className="w-full bg-sanctum-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : 'Activate Account'}
                </button>
            </form>
        )}
      </div>
    </div>
  );
}