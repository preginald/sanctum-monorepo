import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, CheckCircle, XCircle, Loader2, Lock, Bell, Save, Key, Copy, Trash2, Plus, Clock, AlertTriangle } from 'lucide-react';
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

  // API Tokens (The Keymaster)
  const [tokens, setTokens] = useState([]);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({ name: '', expires_in_days: 90 });
  const [newToken, setNewToken] = useState(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => { fetchTokens(); 
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

  const fetchTokens = async () => {
      try {
          const res = await api.get('/api-tokens');
          setTokens(res.data);
      } catch (e) { console.warn("Could not load API tokens", e); }
  };

  const handleCreateToken = async () => {
      setCreatingToken(true);
      try {
          const params = new URLSearchParams({ name: tokenForm.name });
          if (tokenForm.expires_in_days) params.append('expires_in_days', tokenForm.expires_in_days);
          const res = await api.post(`/api-tokens?${params.toString()}`);
          setNewToken(res.data.token);
          setShowCreateToken(false);
          setTokenForm({ name: '', expires_in_days: 90 });
          fetchTokens();
          addToast("API token created", "success");
      } catch (e) {
          addToast("Failed to create token", "danger");
      } finally { setCreatingToken(false); }
  };

  const handleRevokeToken = async (tokenId, prefix) => {
      if (!confirm(`Revoke token ${prefix}...? This cannot be undone.`)) return;
      try {
          await api.delete(`/api-tokens/${tokenId}`);
          fetchTokens();
          addToast("Token revoked", "info");
      } catch (e) { addToast("Failed to revoke token", "danger"); }
  };

  const copyToken = (text) => {
      navigator.clipboard.writeText(text);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title="My Profile" onRefresh={() => { fetchProfile(); fetchPrefs(); fetchTokens(); }}>
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


          {/* ── PERSONAL ACCESS TOKENS (The Keymaster) ── */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Key size={20} className="text-sanctum-gold" /> Personal Access Tokens</h3>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">

                {/* New token alert — shown once */}
                {newToken && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-green-300 mb-2">Token created — copy it now!</p>
                                <p className="text-[10px] text-amber-300 mb-3">This token will not be shown again. Store it securely.</p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-black/40 px-3 py-2 rounded text-xs text-green-400 font-mono break-all">{newToken}</code>
                                    <button onClick={() => copyToken(newToken)} className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-bold flex items-center gap-1">
                                        {tokenCopied ? <><CheckCircle size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setNewToken(null)} className="text-slate-500 hover:text-white"><XCircle size={16}/></button>
                        </div>
                    </div>
                )}

                {/* Create form */}
                {showCreateToken ? (
                    <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <h4 className="text-sm font-bold mb-3">Create New Token</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs opacity-50 block mb-1">Token Name</label>
                                <input
                                    autoFocus
                                    className="w-full p-2 bg-black/40 border border-slate-600 rounded text-white text-sm focus:border-sanctum-gold focus:outline-none"
                                    placeholder="CLI Scripts, CI/CD, etc."
                                    value={tokenForm.name}
                                    onChange={e => setTokenForm({...tokenForm, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs opacity-50 block mb-1">Expires</label>
                                <select
                                    className="w-full p-2 bg-black/40 border border-slate-600 rounded text-white text-sm focus:border-sanctum-gold focus:outline-none"
                                    value={tokenForm.expires_in_days || ''}
                                    onChange={e => setTokenForm({...tokenForm, expires_in_days: e.target.value ? parseInt(e.target.value) : null})}
                                >
                                    <option value="30">30 days</option>
                                    <option value="60">60 days</option>
                                    <option value="90">90 days</option>
                                    <option value="180">180 days</option>
                                    <option value="365">1 year</option>
                                    <option value="">Never</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowCreateToken(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">Cancel</button>
                            <button onClick={handleCreateToken} disabled={!tokenForm.name || creatingToken} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-gold text-slate-900 font-bold text-sm disabled:opacity-40">
                                {creatingToken ? <Loader2 size={14} className="animate-spin"/> : <Key size={14}/>} Generate Token
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        <button onClick={() => setShowCreateToken(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 border border-slate-700 hover:border-sanctum-gold hover:bg-sanctum-gold/5 text-sm font-bold transition-colors">
                            <Plus size={16} className="text-sanctum-gold" /> Create Token
                        </button>
                    </div>
                )}

                {/* Token list */}
                {tokens.length > 0 ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-4 px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                            <div className="col-span-3">Name</div>
                            <div className="col-span-2">Prefix</div>
                            <div className="col-span-2">Created</div>
                            <div className="col-span-2">Last Used</div>
                            <div className="col-span-2">Expires</div>
                            <div className="col-span-1"></div>
                        </div>
                        {tokens.map(t => (
                            <div key={t.id} className={`grid grid-cols-12 gap-4 px-3 py-3 rounded-lg border transition-colors group ${t.is_active && !t.is_expired ? 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600' : 'bg-red-500/5 border-red-500/20 opacity-60'}`}>
                                <div className="col-span-3 flex items-center gap-2">
                                    <Key size={14} className={t.is_active && !t.is_expired ? 'text-sanctum-gold' : 'text-red-400'} />
                                    <span className="text-sm font-semibold truncate">{t.name}</span>
                                </div>
                                <div className="col-span-2 flex items-center">
                                    <code className="text-xs font-mono text-slate-400 bg-black/30 px-2 py-0.5 rounded">{t.prefix}...</code>
                                </div>
                                <div className="col-span-2 text-xs text-slate-400 flex items-center">{new Date(t.created_at).toLocaleDateString()}</div>
                                <div className="col-span-2 text-xs flex items-center gap-1">
                                    {t.last_used_at ? (
                                        <span className="text-green-400"><Clock size={10}/> {new Date(t.last_used_at).toLocaleDateString()}</span>
                                    ) : (
                                        <span className="text-slate-600 italic">Never</span>
                                    )}
                                </div>
                                <div className="col-span-2 text-xs flex items-center">
                                    {t.is_expired ? (
                                        <span className="text-red-400 font-bold">Expired</span>
                                    ) : !t.is_active ? (
                                        <span className="text-red-400 font-bold">Revoked</span>
                                    ) : t.expires_at ? (
                                        <span className="text-slate-400">{new Date(t.expires_at).toLocaleDateString()}</span>
                                    ) : (
                                        <span className="text-slate-600">Never</span>
                                    )}
                                </div>
                                <div className="col-span-1 flex items-center justify-end">
                                    {t.is_active && !t.is_expired && (
                                        <button onClick={() => handleRevokeToken(t.id, t.prefix)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all" title="Revoke token">
                                            <Trash2 size={14}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 opacity-40">
                        <Key size={32} className="mx-auto mb-2" />
                        <p className="text-sm">No tokens yet. Create one to use with CLI tools and scripts.</p>
                    </div>
                )}

                <div className="mt-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <p className="text-[10px] text-blue-300 font-mono">
                        <span className="font-bold">Usage:</span> export SANCTUM_API_TOKEN=sntm_your_token_here
                    </p>
                </div>
            </div>
          </div>

      </div>
    </Layout>
  );
}