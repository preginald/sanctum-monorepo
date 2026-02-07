import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, FileText, Download, ArrowRight } from 'lucide-react';
import api from '../lib/api';

export default function AuditIndex() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [audits, setAudits] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role !== 'client';

  useEffect(() => { fetchData(); }, [token]);

const fetchData = async () => {
  try {
    const [auditRes, accRes] = await Promise.all([
      api.get('/audits'),
      api.get('/accounts')
    ]);
    
    // Fetch template names for each audit
    const auditsWithTemplates = await Promise.all(
      auditRes.data.map(async (audit) => {
        try {
          const detailRes = await api.get(`/sentinel/audits/${audit.id}`);
          return {
            ...audit,
            template_name: detailRes.data.template_name || 'No Framework',
            security_score: detailRes.data.security_score || 0
          };
        } catch (e) {
          return { ...audit, template_name: 'No Framework', security_score: 0 };
        }
      })
    );
    
    setAudits(auditsWithTemplates);
    
    const accMap = {};
    accRes.data.forEach(a => accMap[a.id] = a.name);
    setClients(accMap);
    
  } catch (e) { 
    console.error(e); 
  } finally { 
    setLoading(false); 
  }
};

  return (
    <Layout title="Audit Registry">
      <div className="flex justify-end mb-6">
        {isAdmin && (
        <button 
        onClick={() => {
  const accountId = prompt('Enter Account ID (or leave blank to select from clients):');
  if (accountId === null) return; // Cancelled
  navigate(`/audit/new${accountId ? `?account=${accountId}` : ''}`);
}}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 shadow-lg transition-transform hover:-translate-y-1"
        >
          <Plus size={18} /> Initialize Audit
        </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
        <thead className="bg-black/20 text-xs uppercase text-slate-400 font-bold tracking-wider">
  <tr>
    <th className="p-4">Client</th>
    <th className="p-4">Framework</th>
    <th className="p-4 w-32">Compliance Score</th>
    <th className="p-4 w-24">Status</th>
    <th className="p-4 w-20 text-right">Actions</th>
  </tr>
</thead>
          <tbody className="text-sm text-white divide-y divide-slate-800">
          {audits.map(a => (
  <tr key={a.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/audit/${a.id}`)}>
    
    {/* CLIENT */}
    <td className="p-4">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/clients/${a.account_id}`);
        }}
        className="font-bold hover:underline hover:text-sanctum-gold"
      >
        {clients[a.account_id] || 'Unknown'}
      </button>
    </td>
    
    {/* FRAMEWORK */}
    <td className="p-4">
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-slate-500" />
        <span className="text-sm">{a.template_name}</span>
      </div>
    </td>
    
    {/* SCORE */}
    <td className="p-4">
      <div className="flex items-center gap-2">
        <div className={`text-2xl font-bold font-mono ${a.security_score < 50 ? 'text-red-500' : a.security_score < 80 ? 'text-yellow-500' : 'text-green-500'}`}>
          {a.security_score}
        </div>
        <span className="text-xs text-slate-500">/100</span>
      </div>
    </td>
    
    {/* STATUS */}
    <td className="p-4">
      <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
        a.status === 'finalized' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'
      }`}>
        {a.status}
      </span>
    </td>
    
    {/* ACTIONS */}
    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-end gap-2">
        {a.report_pdf_path && (
          <a 
            href={a.report_pdf_path} 
            target="_blank" 
            className="p-2 rounded hover:bg-white/10 text-sanctum-gold" 
            title="Download PDF"
          >
            <Download size={16} />
          </a>
        )}
        <button 
          onClick={() => navigate(`/audit/${a.id}`)} 
          className="p-2 rounded hover:bg-white/10 text-blue-400" 
          title="Open Assessment"
        >
          <ArrowRight size={16} />
        </button>
      </div>
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