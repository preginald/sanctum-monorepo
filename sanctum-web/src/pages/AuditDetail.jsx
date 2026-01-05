import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, Plus, Trash2, FileText, CheckCircle, AlertTriangle, XCircle, Download, Save, RefreshCw, Edit2, ArrowLeft, Clock } from 'lucide-react';
import api from '../lib/api';

export default function AuditDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(!id);
  
  // Data State
  const [audit, setAudit] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [items, setItems] = useState([
    { category: 'Security', item: 'Firewall', status: 'green', comment: 'Standard ruleset active.' }
  ]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    const init = async () => {
      try {
        const cRes = await api.get('/accounts');
        setClients(cRes.data);

        if (id) {
          fetchAudit();
        } else {
          setLoading(false);
        }
      } catch (err) { console.error(err); setLoading(false); }
    };
    if (token) init();
  }, [token, id]);

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/audits/${id}`);
      setAudit(res.data);
      setSelectedAccount(res.data.account_id);
      if (res.data.content?.items) setItems(res.data.content.items);
      setPdfUrl(res.data.report_pdf_path);
      setStatus(res.data.status);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const addItem = () => setItems([...items, { category: '', item: '', status: 'green', comment: '' }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx][field] = val;
    setItems(newItems);
  };

  // Save/Update Logic
  const handleSave = async (finalize = false) => {
    if (!selectedAccount) return alert("Select a client first.");
    
    try {
      let currentId = id;

      if (!id) {
        const res = await api.post('/audits', {
          account_id: selectedAccount,
          items: items
        });
        currentId = res.data.id;
        navigate(`/audit/${currentId}`, { replace: true });
        setIsEditing(false);
      } else {
        await api.put(`/audits/${id}`, { items: items });
        setIsEditing(false);
      }

      if (finalize) {
        await performFinalize(currentId);
      } else {
        fetchAudit();
      }
    } catch (err) { alert("Operation Failed"); }
  };

  // Dedicated Finalize Action (For Read Mode)
  const performFinalize = async (targetId) => {
    try {
      const finalRes = await api.post(`/audits/${targetId}/finalize`, {});
      setPdfUrl(finalRes.data.report_pdf_path);
      setStatus('finalized');
      // Force reload to get updated timestamps
      fetchAudit(); 
      alert("Report Generated Successfully");
    } catch (err) { alert("Finalization Failed"); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;

  const clientName = clients.find(c => c.id === selectedAccount)?.name || 'Unknown Client';

  return (
    <Layout title={id ? `Audit Reference: ${id.slice(0,8)}` : "New Audit"}>
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/audit')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold">{clientName}</h1>
            <p className="opacity-50 text-sm">Technical Risk Assessment</p>
          </div>
        </div>

        {/* CONTROLS */}
        {!isEditing ? (
          <div className="flex gap-2">
            {/* Direct Finalize Button (If Draft) */}
            {status === 'draft' && (
              <button 
                onClick={() => performFinalize(id)} 
                className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-gold hover:bg-yellow-500 text-slate-900 text-sm font-bold shadow-lg animate-pulse"
              >
                <FileText size={16} /> Finalize & Generate
              </button>
            )}
            
            {/* PDF Download (If Finalized) */}
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sanctum-gold text-sm font-bold">
                <Download size={16} /> PDF
              </a>
            )}
            
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-blue hover:bg-blue-600 text-white text-sm font-bold">
              <Edit2 size={16} /> Edit Data
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => id ? setIsEditing(false) : navigate('/audit')} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm">Cancel</button>
            <button onClick={() => handleSave(false)} className="flex items-center gap-2 px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm">
              <Save size={16} /> Save Draft
            </button>
            <button onClick={() => handleSave(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-gold text-slate-900 hover:bg-yellow-500 text-sm font-bold shadow-lg">
              {pdfUrl ? <RefreshCw size={16} /> : <FileText size={16} />} 
              {pdfUrl ? 'Regenerate PDF' : 'Finalize & Generate'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            
            {/* TIMESTAMPS */}
            {audit && (
              <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-slate-700">
                <div>
                  <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1"><Clock size={12}/> Created</label>
                  <span className="text-sm font-mono opacity-80">{formatDate(audit.created_at)}</span>
                </div>
                {/* Show Finalized Date if exists, otherwise Modified */}
                {audit.finalized_at ? (
                   <div>
                    <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1 text-green-500"><CheckCircle size={12}/> Finalized</label>
                    <span className="text-sm font-mono opacity-80">{formatDate(audit.finalized_at)}</span>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1 text-yellow-500"><Clock size={12}/> Modified</label>
                    <span className="text-sm font-mono opacity-80">{formatDate(audit.updated_at)}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1 text-blue-400"><CheckCircle size={12}/> Status</label>
                  <span className="text-sm font-bold uppercase">{status}</span>
                </div>
              </div>
            )}

            {/* CLIENT SELECTOR (New Only) */}
            {!id && isEditing && (
              <div className="mb-6">
                <label className="text-xs uppercase opacity-70 block mb-1">Target Client</label>
                <select 
                  className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white outline-none"
                  value={selectedAccount}
                  onChange={e => setSelectedAccount(e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* --- READ MODE --- */}
            {!isEditing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-black/20 rounded border border-slate-700 text-center">
                    <span className="text-xs uppercase opacity-50">Security Score</span>
                    <div className={`text-4xl font-bold ${audit.security_score < 50 ? 'text-red-500' : audit.security_score < 80 ? 'text-orange-500' : 'text-green-500'}`}>
                      {audit.security_score}/100
                    </div>
                  </div>
                  <div className="p-4 bg-black/20 rounded border border-slate-700 text-center">
                    <span className="text-xs uppercase opacity-50">Infrastructure</span>
                    <div className="text-4xl font-bold text-white">
                      {audit.infrastructure_score}/100
                    </div>
                  </div>
                </div>

                {items.map((row, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-3 border-b border-slate-800 last:border-0">
                    <div className="w-8 pt-1">
                      {row.status === 'red' && <XCircle className="text-red-500" size={20} />}
                      {row.status === 'amber' && <AlertTriangle className="text-orange-500" size={20} />}
                      {row.status === 'green' && <CheckCircle className="text-green-500" size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-white">{row.item}</span>
                        <span className="text-xs opacity-50 uppercase">{row.category}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{row.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* --- EDIT MODE --- */}
            {isEditing && (
              <>
                <div className="space-y-4">
                  {items.map((row, idx) => (
                    <div key={idx} className={`grid grid-cols-12 gap-2 items-start p-3 rounded bg-black/20 border border-slate-700/50`}>
                      <div className="col-span-12 md:col-span-3">
                        <input placeholder="Category" className="w-full p-2 rounded bg-transparent border border-slate-700 text-white text-sm" value={row.category} onChange={e => updateItem(idx, 'category', e.target.value)} />
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <input placeholder="Item" className="w-full p-2 rounded bg-transparent border border-slate-700 text-white text-sm" value={row.item} onChange={e => updateItem(idx, 'item', e.target.value)} />
                      </div>
                      <div className="col-span-12 md:col-span-4 flex gap-1">
                        {['red', 'amber', 'green'].map(color => (
                          <button key={color} onClick={() => updateItem(idx, 'status', color)} className={`flex-1 py-1 rounded flex justify-center items-center transition-all ${row.status === color ? (color === 'red' ? 'bg-red-600' : color === 'amber' ? 'bg-orange-600' : 'bg-green-600') : 'bg-slate-800 opacity-50'}`}>
                            {color === 'red' && <XCircle size={14} />}
                            {color === 'amber' && <AlertTriangle size={14} />}
                            {color === 'green' && <CheckCircle size={14} />}
                          </button>
                        ))}
                      </div>
                      <div className="col-span-12 flex gap-2">
                        <input placeholder="Analysis..." className="flex-1 p-2 rounded bg-transparent border border-slate-700 text-white text-xs" value={row.comment} onChange={e => updateItem(idx, 'comment', e.target.value)} />
                        <button onClick={() => removeItem(idx)} className="text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="mt-4 w-full py-2 border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-white rounded text-sm flex justify-center items-center gap-2">
                  <Plus size={14} /> Add Checklist Item
                </button>
              </>
            )}

          </div>
        </div>

        {/* RIGHT: COMMENT STREAM */}
        <div className="h-[600px]">
          {id ? (
            <CommentStream resourceType="audit" resourceId={id} />
          ) : (
            <div className="h-full bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center opacity-30 text-sm">
              Save draft to enable comments.
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}