import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, Trash2, FileText, CheckCircle, AlertTriangle, XCircle, Download } from 'lucide-react';
import api from '../lib/api';

export default function AuditWizard() {
  const { token, user } = useAuthStore();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [selectedAccount, setSelectedAccount] = useState('');
  const [items, setItems] = useState([
    { category: 'Security', item: 'Firewall', status: 'green', comment: 'Standard ruleset active.' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // Theme Logic
  const theme = {
    card: isNaked ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700",
    input: isNaked ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-black/20 border-white/10 text-white",
    text: isNaked ? "text-slate-900" : "text-white",
    btnPrimary: isNaked ? "bg-naked-pink hover:bg-pink-600" : "bg-sanctum-blue hover:bg-blue-600"
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/accounts', { headers: { Authorization: `Bearer ${token}` } });
        setClients(res.data);
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    if (token) fetchClients();
  }, [token]);

  // Row Logic
  const addItem = () => setItems([...items, { category: '', item: '', status: 'green', comment: '' }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx][field] = val;
    setItems(newItems);
  };

  const generateReport = async () => {
    if (!selectedAccount) return alert("Select a client first.");
    setIsSubmitting(true);
    setPdfUrl(null);

    try {
      // 1. Create Draft
      const draftRes = await api.post('/audits', {
        account_id: selectedAccount,
        items: items
      }, { headers: { Authorization: `Bearer ${token}` } });

      // 2. Finalize & Generate PDF
      const finalRes = await api.post(`/audits/${draftRes.data.id}/finalize`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      });

      setPdfUrl(finalRes.data.report_pdf_path);
    } catch (err) {
      alert("Generation Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout title="Audit Engine">
      <div className={`max-w-5xl mx-auto p-6 rounded-xl border ${theme.card}`}>
        
        {/* HEADER & CLIENT SELECT */}
        <div className="flex justify-between items-end mb-8 border-b border-gray-700 pb-6">
          <div className="w-1/3">
            <label className="text-xs uppercase opacity-70 block mb-1">Target Client</label>
            <select 
              className={`w-full p-3 rounded border outline-none ${theme.input}`}
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
            >
              <option value="">-- Select --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          
          {pdfUrl && (
            <a 
              href={pdfUrl} 
              target="_blank" 
              className="flex items-center gap-2 px-6 py-3 rounded bg-green-600 text-white font-bold hover:bg-green-500 animate-pulse"
            >
              <Download size={20} /> Download Report
            </a>
          )}
        </div>

        {/* ITEMS LIST */}
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-12 gap-4 text-xs uppercase opacity-50 px-2">
            <div className="col-span-2">Category</div>
            <div className="col-span-3">Item Check</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3">Analysis</div>
            <div className="col-span-1"></div>
          </div>

          {items.map((row, idx) => (
            <div key={idx} className={`grid grid-cols-12 gap-4 items-start p-3 rounded ${idx % 2 === 0 ? 'bg-black/10' : ''}`}>
              
              {/* Category */}
              <div className="col-span-2">
                <input 
                  placeholder="e.g. Network"
                  className={`w-full p-2 rounded border outline-none ${theme.input}`}
                  value={row.category}
                  onChange={e => updateItem(idx, 'category', e.target.value)}
                />
              </div>

              {/* Item */}
              <div className="col-span-3">
                <input 
                  placeholder="e.g. Firewall"
                  className={`w-full p-2 rounded border outline-none ${theme.input}`}
                  value={row.item}
                  onChange={e => updateItem(idx, 'item', e.target.value)}
                />
              </div>

              {/* Traffic Light Selectors */}
              <div className="col-span-3 flex gap-1">
                <button 
                  onClick={() => updateItem(idx, 'status', 'red')}
                  className={`flex-1 py-2 rounded flex justify-center ${row.status === 'red' ? 'bg-red-600 text-white shadow-lg ring-1 ring-white' : 'bg-red-900/20 text-red-500 hover:bg-red-900/40'}`}
                >
                  <XCircle size={16} />
                </button>
                <button 
                  onClick={() => updateItem(idx, 'status', 'amber')}
                  className={`flex-1 py-2 rounded flex justify-center ${row.status === 'amber' ? 'bg-orange-600 text-white shadow-lg ring-1 ring-white' : 'bg-orange-900/20 text-orange-500 hover:bg-orange-900/40'}`}
                >
                  <AlertTriangle size={16} />
                </button>
                <button 
                  onClick={() => updateItem(idx, 'status', 'green')}
                  className={`flex-1 py-2 rounded flex justify-center ${row.status === 'green' ? 'bg-green-600 text-white shadow-lg ring-1 ring-white' : 'bg-green-900/20 text-green-500 hover:bg-green-900/40'}`}
                >
                  <CheckCircle size={16} />
                </button>
              </div>

              {/* Comment */}
              <div className="col-span-3">
                <input 
                  placeholder="Observations..."
                  className={`w-full p-2 rounded border outline-none ${theme.input}`}
                  value={row.comment}
                  onChange={e => updateItem(idx, 'comment', e.target.value)}
                />
              </div>

              {/* Delete */}
              <div className="col-span-1 flex justify-center pt-2">
                <button onClick={() => removeItem(idx)} className="text-gray-500 hover:text-red-500"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <button onClick={addItem} className={`flex items-center gap-2 px-4 py-2 rounded border opacity-70 hover:opacity-100 ${theme.text}`}>
            <Plus size={16} /> Add Row
          </button>

          <button 
            onClick={generateReport} 
            disabled={isSubmitting}
            className={`px-8 py-3 rounded font-bold shadow-xl transition-all hover:-translate-y-1 ${theme.btnPrimary} text-white disabled:opacity-50`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : 'GENERATE ASSET'}
          </button>
        </div>

      </div>
    </Layout>
  );
}