import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, ArrowLeft, Save, Shield, Download, Play, Plus, Trash2, Globe } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AuditDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [audit, setAudit] = useState(null);
  const [items, setItems] = useState([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
      // If ID is a UUID (length > 10 is a safe heuristic), fetch it.
      // If ID is 'new' or undefined, initialize a fresh form.
      if (id && id !== 'new') {
          fetchAudit();
      } else {
          initNewAudit();
      }
  }, [id, accountId]);

  const initNewAudit = async () => {
      setAudit({ account_id: accountId, status: 'draft', security_score: 0, infrastructure_score: 0 });
      setLoading(false);
  };

  const fetchAudit = async () => {
      try {
          const res = await api.get(`/audits/${id}`);
          setAudit(res.data);
          setItems(res.data.content?.items || []);
          
          // Try to fetch domain from client if not set
          if (res.data.account_id) {
              const acc = await api.get(`/accounts/${res.data.account_id}`);
              // Heuristic: guess domain from email or name
              if (acc.data.billing_email) {
                  setDomain(acc.data.billing_email.split('@')[1]);
              }
          }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  // --- ACTIONS ---

  const runScan = async (e) => {
      e.preventDefault();
      if (!domain) return addToast("Enter a domain first", "warning");
      
      setScanning(true);
      try {
          const res = await api.post('/sentinel/scan', { domain });
          // Append new results to existing items
          setItems(prev => [...prev, ...res.data]);
          addToast(`Sentinel found ${res.data.length} data points`, "success");
      } catch(e) {
          addToast("Scan failed. Domain might be unreachable.", "danger");
      } finally { setScanning(false); }
  };

  const saveAudit = async () => {
      setSaving(true);
      try {
          const payload = { items }; // Simplified for update
          if (id) {
              await api.put(`/audits/${id}`, payload);
              addToast("Audit saved", "success");
          } else {
              const res = await api.post('/audits', { account_id: accountId, items });
              addToast("Audit created", "success");
              navigate(`/audit/${res.data.id}`);
          }
      } catch(e) { addToast("Save failed", "danger"); }
      finally { setSaving(false); }
  };

  const finalizeAudit = async () => {
      if(!confirm("Finalize and Lock? This will generate the PDF report.")) return;
      setSaving(true);
      try {
          await api.post(`/audits/${id}/finalize`);
          addToast("Report Generated", "success");
          fetchAudit();
      } catch(e) { addToast("Finalization failed", "danger"); }
      finally { setSaving(false); }
  };

  const addItem = () => {
      setItems([...items, { category: 'General', item: 'New Observation', status: 'Amber', comment: '' }]);
  };

  const updateItem = (index, field, value) => {
      const newItems = [...items];
      newItems[index][field] = value;
      setItems(newItems);
  };

  const removeItem = (index) => {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
  };

  const getPdfUrl = (path) => {
      if (!path) return '#';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return `http://${window.location.hostname}:8000${path}`;
      }
      return path;
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title={id ? "Security Audit" : "New Assessment"}>
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20}/></button>
              <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                      <Shield className={audit?.status === 'finalized' ? "text-green-500" : "text-slate-500"} />
                      {audit?.status === 'finalized' ? 'Audit Report (Locked)' : 'Draft Assessment'}
                  </h1>
                  {audit?.status === 'finalized' && (
                      <div className="flex gap-4 mt-2 text-sm font-mono opacity-70">
                          <span>Sec Score: {audit.security_score}</span>
                          <span>Infra Score: {audit.infrastructure_score}</span>
                      </div>
                  )}
              </div>
          </div>
          <div className="flex gap-2">
              {audit?.report_pdf_path && (
                  <a href={getPdfUrl(audit.report_pdf_path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded font-bold text-sm">
                      <Download size={16}/> Report
                  </a>
              )}
              {audit?.status !== 'finalized' && (
                  <>
                      <button onClick={saveAudit} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-sm">
                          <Save size={16}/> Save Draft
                      </button>
                      <button onClick={finalizeAudit} disabled={saving || !id} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 hover:bg-yellow-500 rounded font-bold text-sm">
                          {saving ? <Loader2 className="animate-spin" size={16}/> : <><Shield size={16}/> Finalize & Generate PDF</>}
                      </button>
                  </>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: CONTROLS */}
          <div className="space-y-6">
              
              {/* SENTINEL SCANNER */}
              {audit?.status !== 'finalized' && (
                  <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden">
                      {/* Background Watermark */}
                      <div className="absolute -right-6 -top-6 text-slate-800 opacity-50 pointer-events-none">
                          <Globe size={100} />
                      </div>
                      
                      <div className="relative z-10">
                          <h3 className="font-bold text-sm uppercase tracking-widest text-blue-400 mb-2">The Sentinel</h3>
                          <p className="text-xs text-slate-400 mb-4">Automated Reconnaissance Engine</p>
                          
                          <form onSubmit={runScan} className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                  <div className="absolute left-3 top-2.5 text-slate-500 pointer-events-none">
                                      <Globe size={16} />
                                  </div>
                                  <input 
                                    placeholder="digitalsanctum.com.au" 
                                    className="w-full bg-black/40 border border-slate-600 rounded-lg pl-10 pr-4 h-10 text-sm font-mono text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-600"
                                    value={domain}
                                    onChange={e => setDomain(e.target.value)}
                                  />
                              </div>
                              <button 
                                type="submit"
                                disabled={scanning || !domain} 
                                className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
                              >
                                  {scanning ? <Loader2 className="animate-spin" size={14}/> : <Play size={14} className="fill-current"/>}
                                  {scanning ? "Scanning" : "Scan Target"}
                              </button>
                          </form>
                      </div>
                  </div>
              )}

              {/* STATS (If Saved) */}
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="font-bold text-sm uppercase text-slate-500 mb-4">Item Breakdown</h3>
                  <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-green-500">Pass (Green)</span><span>{items.filter(i => i.status === 'Green').length}</span></div>
                      <div className="flex justify-between"><span className="text-yellow-500">Warn (Amber)</span><span>{items.filter(i => i.status === 'Amber').length}</span></div>
                      <div className="flex justify-between"><span className="text-red-500">Fail (Red)</span><span>{items.filter(i => i.status === 'Red').length}</span></div>
                  </div>
              </div>
          </div>

          {/* RIGHT: AUDIT ITEMS */}
          <div className="lg:col-span-2">
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-black/20 text-slate-500 uppercase text-xs font-bold">
                          <tr>
                              <th className="p-4 w-32">Category</th>
                              <th className="p-4 w-48">Observation</th>
                              <th className="p-4 w-32">Status</th>
                              <th className="p-4">Comment</th>
                              <th className="p-4 w-10"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                  <td className="p-2">
                                      <input className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)} disabled={audit?.status === 'finalized'}/>
                                  </td>
                                  <td className="p-2">
                                      <input className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={item.item} onChange={e => updateItem(idx, 'item', e.target.value)} disabled={audit?.status === 'finalized'}/>
                                  </td>
                                  <td className="p-2">
                                      <select 
                                        className={`w-full bg-transparent border-none outline-none font-bold ${item.status === 'Red' ? 'text-red-500' : (item.status === 'Amber' ? 'text-yellow-500' : 'text-green-500')}`} 
                                        value={item.status} 
                                        onChange={e => updateItem(idx, 'status', e.target.value)}
                                        disabled={audit?.status === 'finalized'}
                                      >
                                          <option value="Green">Green</option>
                                          <option value="Amber">Amber</option>
                                          <option value="Red">Red</option>
                                      </select>
                                  </td>
                                  <td className="p-2">
                                      <input className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-slate-400" value={item.comment} onChange={e => updateItem(idx, 'comment', e.target.value)} disabled={audit?.status === 'finalized'}/>
                                  </td>
                                  <td className="p-2 text-center">
                                      {audit?.status !== 'finalized' && (
                                          <button onClick={() => removeItem(idx)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Trash2 size={16}/>
                                          </button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {audit?.status !== 'finalized' && (
                      <div className="p-4 border-t border-slate-800">
                          <button onClick={addItem} className="flex items-center gap-2 text-xs font-bold text-blue-500 hover:text-white uppercase tracking-widest">
                              <Plus size={14}/> Add Observation
                          </button>
                      </div>
                  )}
              </div>
          </div>

      </div>
    </Layout>
  );
}
