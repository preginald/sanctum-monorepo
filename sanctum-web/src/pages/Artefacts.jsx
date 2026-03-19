import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, FileText, Link2, Code, Key, File, Search, ChevronUp, ChevronDown } from 'lucide-react';
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

const statusColor = (s) => {
  const map = {
    draft: 'bg-slate-500/20 text-slate-400',
    review: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-green-500/20 text-green-400',
    superseded: 'bg-blue-500/10 text-blue-300',
    archived: 'bg-red-500/10 text-red-300',
  };
  return map[s] || 'bg-white/10 text-slate-300';
};

const sensitivityColor = (s) => {
  const map = {
    public: 'bg-green-500/20 text-green-400',
    internal: 'bg-slate-500/20 text-slate-400',
    confidential: 'bg-red-500/20 text-red-400',
  };
  return map[s] || '';
};

const ARTEFACT_TYPES = ['file', 'url', 'code_path', 'document', 'credential_ref'];
const STATUS_TABS = ['all', 'draft', 'review', 'approved', 'archived'];
const SENSITIVITIES = ['public', 'internal', 'confidential'];

export default function Artefacts() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [artefacts, setArtefacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Derived categories from data
  const [categories, setCategories] = useState([]);

  useEffect(() => { fetchArtefacts(); }, [typeFilter]);

  const fetchArtefacts = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('artefact_type', typeFilter);
      const res = await api.get(`/artefacts?${params.toString()}`);
      setArtefacts(res.data);
      // Extract unique categories
      const cats = [...new Set(res.data.map(a => a.category).filter(Boolean))];
      setCategories(cats);
    } catch (e) {
      addToast("Failed to load artefacts", "danger");
    } finally { setLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // Apply client-side filters
  let filtered = artefacts;
  if (statusTab !== 'all') filtered = filtered.filter(a => a.status === statusTab);
  if (categoryFilter) filtered = filtered.filter(a => a.category === categoryFilter);
  if (sensitivityFilter) filtered = filtered.filter(a => a.sensitivity === sensitivityFilter);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.content?.toLowerCase().includes(q)
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (sortBy === 'created_at' || sortBy === 'updated_at') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    } else if (typeof av === 'string') {
      av = av?.toLowerCase() || '';
      bv = bv?.toLowerCase() || '';
    }
    if (av < bv) return sortOrder === 'asc' ? -1 : 1;
    if (av > bv) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (col) => {
    if (sortBy === col) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? <ChevronUp size={12} className="inline ml-1" /> : <ChevronDown size={12} className="inline ml-1" />;
  };

  // Status tab counts
  const statusCounts = {
    all: artefacts.length,
    draft: artefacts.filter(a => a.status === 'draft').length,
    review: artefacts.filter(a => a.status === 'review').length,
    approved: artefacts.filter(a => a.status === 'approved').length,
    archived: artefacts.filter(a => a.status === 'archived').length,
  };

  return (
    <Layout title="Artefacts">
      {/* STATUS TABS */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-700 pb-2">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`px-3 py-1.5 rounded-t text-xs font-bold uppercase tracking-wider transition-colors ${
              statusTab === tab
                ? 'bg-slate-800 text-white border-b-2 border-sanctum-gold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
            {statusCounts[tab] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-50">({statusCounts[tab]})</span>
            )}
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            placeholder="Search name, description, content..."
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
          {ARTEFACT_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sanctum-gold"
          >
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <select
          value={sensitivityFilter}
          onChange={e => setSensitivityFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sanctum-gold"
        >
          <option value="">All sensitivity</option>
          {SENSITIVITIES.map(s => (
            <option key={s} value={s}>{s}</option>
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
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50 cursor-pointer hover:opacity-80" onClick={() => handleSort('name')}>
                  Name <SortIcon col="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50">Sensitivity</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50 cursor-pointer hover:opacity-80" onClick={() => handleSort('account_name')}>
                  Account <SortIcon col="account_name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider opacity-50 cursor-pointer hover:opacity-80" onClick={() => handleSort('created_at')}>
                  Created <SortIcon col="created_at" />
                </th>
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
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(a.status)}`}>
                      {a.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs opacity-50">{a.category || '—'}</td>
                  <td className="px-4 py-3">
                    {a.sensitivity ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sensitivityColor(a.sensitivity)}`}>
                        {a.sensitivity}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 opacity-60">{a.account_name || 'Internal'}</td>
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
