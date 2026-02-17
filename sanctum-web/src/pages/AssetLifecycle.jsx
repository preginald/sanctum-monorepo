import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, AlertTriangle, Clock, Shield, RefreshCw, Ticket } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AssetLifecycle() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(90);
  const [creatingTicket, setCreatingTicket] = useState(null);

  useEffect(() => { fetchData(); }, [days]);

  const fetchData = async () => {
    if (data) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get(`/assets/lifecycle/expiring?days=${days}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
      addToast("Failed to load asset lifecycle data", "danger");
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleCreateTicket = async (asset) => {
    setCreatingTicket(asset.id);
    try {
      const res = await api.post(`/assets/${asset.id}/renewal-ticket`);
      addToast(`Ticket #${res.data.ticket_id} created: ${res.data.subject}`, "success");
      fetchData();
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to create ticket";
      addToast(msg, "danger");
    } finally { setCreatingTicket(null); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU') : '—';

  const statusBadge = (asset) => {
    if (asset.is_expired) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400">{Math.abs(asset.days_until_expiry)}d expired</span>;
    if (asset.days_until_expiry <= 14) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400">{asset.days_until_expiry}d left</span>;
    if (asset.days_until_expiry <= 30) return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400">{asset.days_until_expiry}d left</span>;
    return <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-yellow-500/20 text-yellow-400">{asset.days_until_expiry}d left</span>;
  };

  if (loading && !data) return <Layout title="Asset Lifecycle"><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></Layout>;

  const { total, expired_count, expiring_count, assets } = data || { total: 0, expired_count: 0, expiring_count: 0, assets: [] };

  return (
    <Layout title="Asset Lifecycle">

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-sanctum-gold" />
            <div>
              <p className="text-xs uppercase opacity-50">Total Tracked</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-orange-400" />
            <div>
              <p className="text-xs uppercase opacity-50">Expiring Soon</p>
              <p className="text-2xl font-bold text-orange-400">{expiring_count}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <div>
              <p className="text-xs uppercase opacity-50">Expired</p>
              <p className="text-2xl font-bold text-red-400">{expired_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs uppercase opacity-50 font-bold">Window:</span>
        {[30, 60, 90, 180].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${days === d ? 'bg-sanctum-gold text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {d} days
          </button>
        ))}
        <button onClick={fetchData} className="ml-auto p-2 hover:bg-white/10 rounded transition-colors" title="Refresh">
          <RefreshCw size={16} className={refreshing ? 'animate-spin text-sanctum-gold' : ''} />
        </button>
      </div>

      {/* TABLE */}
      {assets.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">All clear — no assets expiring within {days} days.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-xs uppercase tracking-widest opacity-50">
                <th className="text-left p-4">Asset</th>
                <th className="text-left p-4">Client</th>
                <th className="text-left p-4">Type</th>
                <th className="text-left p-4">Vendor</th>
                <th className="text-left p-4">Expires</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <tr
                  key={asset.id}
                  className={`border-b border-slate-800 hover:bg-white/5 transition-colors ${asset.is_expired ? 'bg-red-500/5' : ''}`}
                >
                <td className="p-4">
                    <button onClick={() => navigate(`/assets/${asset.id}`)} className="font-bold hover:text-sanctum-gold transition-colors text-left">
                      {asset.name}
                    </button>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => navigate(`/clients/${asset.account_id}`)}
                      className="hover:text-sanctum-gold transition-colors text-left"
                    >
                      {asset.account_name}
                    </button>
                  </td>
                  <td className="p-4 text-xs uppercase opacity-70">{asset.asset_type}</td>
                  <td className="p-4 text-xs opacity-70">{asset.vendor || '—'}</td>
                  <td className="p-4 text-xs">{formatDate(asset.expires_at)}</td>
                  <td className="p-4">{statusBadge(asset)}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleCreateTicket(asset)}
                      disabled={creatingTicket === asset.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 transition-colors ml-auto"
                    >
                      {creatingTicket === asset.id ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />}
                      Renew
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}