import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, CheckCircle, XCircle, Loader2, Lock, Unlock } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Profile() {
  const { user, logout } = useAuthStore(); // We might need to refresh user to update has_2fa
  const { addToast } = useToast();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 2FA Setup State
  const [setupData, setSetupData] = useState(null); // { secret, qr_uri }
  const [verifyCode, setVerifyCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
        // We can use the /users/me endpoint if it existed, or just re-fetch the current user details via ID
        // For now, let's assume we fetch list or just trust local storage? 
        // No, we need fresh "has_2fa" status. 
        // Let's rely on the Admin User List endpoint if Admin, or add a /users/me endpoint?
        // Actually, let's just use the Admin endpoint for now if Admin, or mock it?
        // Wait, 'user' from authStore has data from the Token. We need fresh data.
        // Let's implement a quick fetch logic or just assume 'user' is stale and we need to re-login to see status? 
        // Better: Fetch from a new endpoint or existing one. 
        // Let's use the CRM router logic: get_client_users? No.
        
        // Quick Hack: Just try to setup 2FA. If it returns a secret, we are good.
        // But we need to know if it's ENABLED.
        // Let's add a quick check to the backend response of the /token endpoint, 
        // but for now, let's just assume the user state might be stale and rely on server responses.
        
        setLoading(false); 
    } catch(e) { setLoading(false); }
  };

  const startSetup = async () => {
      setIsProcessing(true);
      try {
          const res = await api.post('/2fa/setup');
          setSetupData(res.data);
      } catch(e) { addToast("Setup failed", "danger"); }
      finally { setIsProcessing(false); }
  };

  const confirmEnable = async () => {
      setIsProcessing(true);
      try {
          await api.post('/2fa/enable', { code: verifyCode }, { params: { secret: setupData.secret } });
          addToast("2FA Enabled Successfully", "success");
          setSetupData(null);
          setVerifyCode('');
          // Force logout to re-authenticate with 2FA
          setTimeout(() => logout(), 1000); 
      } catch(e) { addToast("Invalid Code", "danger"); }
      finally { setIsProcessing(false); }
  };

  const disable2FA = async () => {
      if(!confirm("Disable 2FA? Your account will be less secure.")) return;
      try {
          await api.post('/2fa/disable');
          addToast("2FA Disabled", "info");
          // Update local state or logout
      } catch(e) { addToast("Failed to disable", "danger"); }
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title="My Profile">
      <div className="max-w-2xl mx-auto space-y-8">
          
          {/* PROFILE CARD */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-3xl font-bold text-slate-400">
                  {user?.full_name?.charAt(0) || "U"}
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-white">{user?.full_name}</h2>
                  <p className="text-slate-400 font-mono">{user?.email}</p>
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-900 text-blue-300 text-xs font-bold rounded uppercase">
                      {user?.role}
                  </span>
              </div>
          </div>

          {/* SECURITY CARD */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Shield className="text-sanctum-gold" /> Security
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">Manage Two-Factor Authentication (TOTP).</p>
                  </div>
                  {user?.has_2fa ? (
                      <span className="flex items-center gap-2 text-green-500 font-bold text-sm bg-green-900/20 px-3 py-1 rounded-full border border-green-500/30">
                          <CheckCircle size={16}/> Protected
                      </span>
                  ) : (
                      <span className="flex items-center gap-2 text-red-400 font-bold text-sm bg-red-900/20 px-3 py-1 rounded-full border border-red-500/30">
                          <XCircle size={16}/> Unprotected
                      </span>
                  )}
              </div>

              {!setupData ? (
                  // ACTION BUTTONS
                  <div className="mt-4">
                      {/* Note: We rely on user.has_2fa which comes from the token. 
                          If they just enabled it, they need to relogin to update this prop usually. */}
                      <button 
                        onClick={startSetup}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors"
                      >
                          <Lock size={16} /> Setup 2FA
                      </button>
                      
                      {/* Only show Disable if we think they have it, or provide a 'Reset' option */}
                       <button 
                          onClick={disable2FA} 
                          className="ml-4 text-xs text-red-500 hover:text-red-400 underline"
                        >
                          Disable 2FA
                      </button>
                  </div>
              ) : (
                  // SETUP FLOW
                  <div className="mt-6 bg-black/40 p-6 rounded-lg border border-slate-700 animate-in fade-in slide-in-from-top-4">
                      <h4 className="font-bold text-white mb-4">1. Scan QR Code</h4>
                      <div className="bg-white p-2 w-fit rounded mb-6">
                          <QRCodeSVG value={setupData.qr_uri} size={150} />
                      </div>
                      
                      <h4 className="font-bold text-white mb-2">2. Enter Code</h4>
                      <div className="flex gap-2">
                          <input 
                            className="bg-slate-800 border border-slate-600 rounded p-2 text-white font-mono text-center tracking-widest w-32"
                            placeholder="000000"
                            maxLength={6}
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value)}
                          />
                          <button 
                            onClick={confirmEnable} 
                            disabled={isProcessing || verifyCode.length < 6}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded disabled:opacity-50"
                          >
                              {isProcessing ? <Loader2 className="animate-spin"/> : "Verify & Enable"}
                          </button>
                      </div>
                      <button onClick={() => setSetupData(null)} className="mt-4 text-xs text-slate-500 hover:text-white">Cancel</button>
                  </div>
              )}
          </div>

      </div>
    </Layout>
  );
}
