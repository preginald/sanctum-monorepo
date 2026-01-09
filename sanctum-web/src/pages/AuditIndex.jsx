import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, FileText, Download, ArrowRight } from 'lucide-react';
import api from '../lib/api';

export default function AuditIndex() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const isAdmin = user?.role !== 'client';
  const [audits, setAudits] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [token]);

  const fetchData = async () => {
    try {
      const [auditRes, accRes] = await Promise.all([
        api.get('/audits'),
        api.get('/accounts')
      ]);
      setAudits(auditRes.data);
      
      // Create a map for quick name lookup
      const accMap = {};
      accRes.data.forEach(a => accMap[a.id] = a.name);
      setClients(accMap);
      
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  return (
    <Layout title="Audit Registry">
      <div className="flex justify-end mb-6">
        {isAdmin && (
        <button 
          onClick={() => navigate('/audit/new')} 
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 shadow-lg transition-transform hover:-translate-y-1"
        >
          <Plus size={18} /> Initialize Audit
        </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-xs uppercase text-slate-400">
            <tr>
              <th className="p-4">Reference</th>
              <th className="p-4">Client</th>
              <th className="p-4">Security Score</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm text-white">
            {audits.map(a => (
              <tr key={a.id} className="border-b border-slate-800 hover:bg-white/5 transition-colors">
                <td className="p-4 font-mono opacity-50">{a.id.slice(0,8)}</td>
                <td className="p-4 font-bold">{clients[a.account_id] || 'Unknown'}</td>
                <td className="p-4">
                  <span className={`font-bold ${a.security_score < 50 ? 'text-red-500' : a.security_score < 80 ? 'text-orange-500' : 'text-green-500'}`}>
                    {a.security_score}/100
                  </span>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded bg-white/10 text-xs uppercase">{a.status}</span>
                </td>
                <td className="p-4 text-right flex justify-end gap-2">
                  {a.report_pdf_path && (
                    <a href={a.report_pdf_path} target="_blank" className="p-2 rounded hover:bg-white/10 text-sanctum-gold" title="Download PDF">
                      <Download size={16} />
                    </a>
                  )}
                  <button onClick={() => navigate(`/audit/${a.id}`)} className="p-2 rounded hover:bg-white/10 text-blue-400" title="Open Editor">
                    <ArrowRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {audits.length === 0 && !loading && <div className="p-8 text-center opacity-50">No audits found.</div>}
      </div>
    </Layout>
  );
}