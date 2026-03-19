import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, FileText, Link2, Code, Key, File, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const typeIcon = (type) => {
  const map = { file: File, url: Link2, code_path: Code, document: FileText, credential_ref: Key };
  const Icon = map[type] || FileText;
  return <Icon size={14} className="opacity-40" />;
};

const typeColor = (type) => {
  const map = {
    file: 'bg-blue-500/20 text-blue-400',
    url: 'bg-green-500/20 text-green-400',
    code_path: 'bg-purple-500/20 text-purple-400',
    document: 'bg-orange-500/20 text-orange-400',
    credential_ref: 'bg-red-500/20 text-red-400',
  };
  return map[type] || 'bg-white/10 text-slate-300';
};

const ARTEFACT_TYPES = ['', 'file', 'url', 'code_path', 'document', 'credential_ref'];

export default function Artefacts() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [artefacts, setArtefacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchArtefacts(); }, [typeFilter]);

  const fetchArtefacts = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('artefact_type', typeFilter);
      const res = await api.get(`/artefacts?${params.toString()}`);
      setArtefacts(res.data);
    } catch (e) {
      addToast("Failed to load artefacts", "danger");
    } finally { setLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const filtered = search
    ? artefacts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : artefacts;

  return (
    <Layout title="Artefacts">
      {/* FILTER BAR */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            placeholder="Search artefacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-sanctum-gold"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sanctum-gold"
        >
          <option value="">All types</option>
          {ARTEFACT_TYPES.filter(Boolean).map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm opacity-40 text-center py-10">No artefacts found.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Name</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Account</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Links</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/artefacts/${a.id}`)}
                  className="border-b border-slate-800 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {typeIcon(a.artefact_type)}
                      <span className="font-bold text-sanctum-gold">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor(a.artefact_type)}`}>
                      {a.artefact_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 opacity-60">{a.account_name || 'Internal'}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs opacity-50">{(a.links || []).length}</span>
                  </td>
                  <td className="px-4 py-3 opacity-50 text-xs">{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
