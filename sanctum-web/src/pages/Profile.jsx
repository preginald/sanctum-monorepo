import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, CheckCircle, XCircle, Loader2, Lock, Bell, Save } from 'lucide-react'; // Added Bell, Save
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card'; // Importing Card for consistency
import Button from '../components/ui/Button'; // Importing Button

export default function Profile() {
  const { user, logout } = useAuthStore(); 
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  
  // 2FA Setup State
  const [setupData, setSetupData] = useState(null); 
  const [verifyCode, setVerifyCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Notification Prefs State
  const [prefs, setPrefs] = useState({ email_frequency: 'realtime', force_critical: true });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => { 
      fetchProfile(); 
      fetchPrefs();
  }, []);

  const fetchProfile = async () => {
    // Placeholder for refreshing user profile data if needed
    setLoading(false); 
  };

  const fetchPrefs = async () => {
      try {
          const res = await api.get('/notifications/preferences');
          setPrefs(res.data);
      } catch (e) { console.error("Failed to load prefs", e); }
  };

  // --- 2FA HANDLERS ---
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
          setTimeout(() => logout(), 1000); 
      } catch(e) { addToast("Invalid Code", "danger"); }
      finally { setIsProcessing(false); }
  };

  const disable2FA = async () => {
      if(!confirm("Disable 2FA? Your account will be less secure.")) return;
      try {
          await api.post('/2fa/disable');
          addToast("2FA Disabled", "info");
      } catch(e) { addToast("Failed to disable", "danger"); }
  };

  // --- SIGNAL HANDLERS ---
  const handleSavePrefs = async () => {
      setSavingPrefs(true);
      try {
          await api.put('/notifications/preferences', prefs);
          addToast("Signal configuration updated", "success");
      } catch (e) {
          addToast("Failed to update settings", "error");
      } finally {
          setSavingPrefs(false);
      }
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title="My Profile">
      <div className="max-w-3xl mx-auto space-y-8">
          
          {/* IDENTITY CARD */}
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
                  <div className="mt-4 flex items-center gap-4">
                      <button 
                        onClick={startSetup}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded transition-colors"
                      >
                          <Lock size={16} /> Setup 2FA
                      </button>
                       <button 
                          onClick={disable2FA} 
                          className="text-xs text-red-500 hover:text-red-400 underline"
                        >
                          Disable 2FA
                      </button>
                  </div>
              ) : (
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

          {/* SIGNAL CONFIGURATION (New) */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                <Bell className="text-blue-400" />
                <div>
                    <h3 className="text-lg font-bold text-white">Signal Configuration</h3>
                    <p className="text-xs text-slate-500">Manage how The Sentinel routes alerts to your inbox.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Frequency */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['realtime', 'hourly', 'daily'].map((freq) => (
                        <div 
                            key={freq}
                            onClick={() => setPrefs({ ...prefs, email_frequency: freq })}
                            className={`
                                cursor-pointer p-4 rounded-xl border transition-all
                                ${prefs.email_frequency === freq 
                                    ? 'bg-blue-600/20 border-blue-500 text-white' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}
                            `}
                        >
                            <div className="capitalize font-bold mb-1">{freq}</div>
                            <div className="text-xs opacity-70">
                                {freq === 'realtime' && "Instant dispatch for all events."}
                                {freq === 'hourly' && "Digest email sent every hour."}
                                {freq === 'daily' && "One summary email at 08:00."}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Overrides */}
                <div className="bg-black/20 p-4 rounded-xl border border-slate-800">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={prefs.force_critical} 
                            onChange={e => setPrefs({ ...prefs, force_critical: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 text-red-500 bg-slate-900 focus:ring-red-500"
                        />
                        <div>
                            <span className="font-bold text-white block flex items-center gap-2">
                                <Shield size={14} className="text-red-500"/> Critical Override
                            </span>
                            <span className="text-xs text-slate-500">
                                If enabled, <strong>Critical</strong> alerts bypass batching and send immediately.
                            </span>
                        </div>
                    </label>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSavePrefs} disabled={savingPrefs} variant="primary">
                        {savingPrefs ? <Loader2 className="animate-spin" /> : <><Save size={16} className="mr-2"/> Save Preferences</>}
                    </Button>
                </div>
            </div>
          </div>

      </div>
    </Layout>
  );
}