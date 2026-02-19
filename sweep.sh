#!/bin/bash
# Ticket #185 — API Token Management UI on Profile page

TARGET=~/Dev/DigitalSanctum/sanctum-web/src/pages/Profile.jsx

echo "🔧 Adding API Token management to Profile page..."

python3 << 'PYEOF'
path = "/home/preginald/Dev/DigitalSanctum/sanctum-web/src/pages/Profile.jsx"
with open(path, 'r') as f:
    content = f.read()

changes = 0

# PATCH 1: Update lucide imports
old_imports = "import { Shield, CheckCircle, XCircle, Loader2, Lock, Bell, Save } from 'lucide-react'; // Added Bell, Save"
new_imports = "import { Shield, CheckCircle, XCircle, Loader2, Lock, Bell, Save, Key, Copy, Trash2, Plus, Clock, AlertTriangle } from 'lucide-react';"

if old_imports in content:
    content = content.replace(old_imports, new_imports)
    changes += 1
    print("  ✓ Imports updated")

# PATCH 2: Add state after existing state declarations
old_state = "  const [savingPrefs, setSavingPrefs] = useState(false);"
new_state = """  const [savingPrefs, setSavingPrefs] = useState(false);

  // API Tokens (The Keymaster)
  const [tokens, setTokens] = useState([]);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({ name: '', expires_in_days: 90 });
  const [newToken, setNewToken] = useState(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);"""

if old_state in content:
    content = content.replace(old_state, new_state)
    changes += 1
    print("  ✓ Token state added")

# PATCH 3: Add fetch + create + revoke functions after handleSavePrefs
old_funcs = "  if (loading) return"
new_funcs = """  const fetchTokens = async () => {
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

  if (loading) return"""

if old_funcs in content:
    content = content.replace(old_funcs, new_funcs)
    changes += 1
    print("  ✓ Token functions added")

# PATCH 4: Add fetchTokens to useEffect
old_effect = "  useEffect(() => { "
new_effect = "  useEffect(() => { fetchTokens(); "

if old_effect in content:
    content = content.replace(old_effect, new_effect, 1)
    changes += 1
    print("  ✓ fetchTokens added to useEffect")

# PATCH 5: Add UI section before closing </div></Layout>
old_close = """      </div>
    </Layout>
  );"""

new_close = """
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
  );"""

if old_close in content:
    content = content.replace(old_close, new_close)
    changes += 1
    print("  ✓ Token UI section added")

if changes >= 5:
    with open(path, 'w') as f:
        f.write(content)
    print(f"\n  ✅ All {changes} patches applied")
else:
    print(f"\n  ⚠ Only {changes}/5 patches matched — file NOT written")

PYEOF

# VERIFY
echo ""
echo "=== Verification ==="
grep -cn "fetchTokens\|handleCreateToken\|handleRevokeToken\|Personal Access Tokens" "$TARGET"
echo ""
cd ~/Dev/DigitalSanctum/sanctum-web && npx vite build 2>&1 | tail -3
