import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, Server, Clock, Shield, MapPin, Hash, Cpu, Globe, Ticket, Package, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AssetDetail() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState(false);

  useEffect(() => { fetchAsset(); }, [assetId]);

  const fetchAsset = async () => {
    try {
      const res = await api.get(`/assets/${assetId}`);
      setAsset(res.data);
    } catch (e) {
      addToast("Failed to load asset", "danger");
    } finally { setLoading(false); }
  };

  const handleRenewalTicket = async () => {
    setCreatingTicket(true);
    try {
      const res = await api.post(`/assets/${assetId}/renewal-ticket`);
      addToast(`Ticket #${res.data.ticket_id} created`, "success");
      fetchAsset();
    } catch (e) {
      addToast(e.response?.data?.detail || "Failed to create ticket", "danger");
    } finally { setCreatingTicket(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const statusColor = (s) => {
    const map = { active: 'bg-green-500/20 text-green-400', expiring: 'bg-orange-500/20 text-orange-400', expired: 'bg-red-500/20 text-red-400', decommissioned: 'bg-slate-500/20 text-slate-400' };
    return map[s] || 'bg-white/10 text-slate-300';
  };

  const ticketStatusColor = (s) => {
    const map = { new: 'text-blue-400', in_progress: 'text-yellow-400', resolved: 'text-green-400', closed: 'text-slate-400' };
    return map[s] || 'text-slate-300';
  };

  const priorityColor = (p) => {
    const map = { critical: 'text-red-400', high: 'text-orange-400', normal: 'text-slate-300', low: 'text-slate-500' };
    return map[p] || 'text-slate-300';
  };

  if (loading) return <Layout title="Asset Detail"><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></Layout>;
  if (!asset) return <Layout title="Asset Detail"><p>Asset not found.</p></Layout>;

  const specs = asset.specs && Object.keys(asset.specs).length > 0 ? asset.specs : null;

  return (
    <Layout 
      title={asset.name}
      subtitle={<>{asset.asset_type} • <button onClick={() => navigate(`/clients/${asset.account_id}`)} className="text-sanctum-gold hover:underline">{asset.account_name}</button></>}
      badge={{ label: asset.status, className: statusColor(asset.status) }}
      backPath={-1}
      actions={['expiring', 'expired'].includes(asset.status) ? (
        <button
          onClick={handleRenewalTicket}
          disabled={creatingTicket}
          className="flex items-center gap-2 px-4 py-2 rounded font-bold text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 transition-colors"
        >
          {creatingTicket ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Create Renewal Ticket
        </button>
      ) : null}
    >

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — DETAILS */}
        <div className="lg:col-span-2 space-y-6">

          {/* LIFECYCLE CARD */}
          {asset.expires_at && (
            <div className={`p-5 rounded-xl border ${asset.status === 'expired' ? 'bg-red-500/5 border-red-500/30' : asset.status === 'expiring' ? 'bg-orange-500/5 border-orange-500/30' : 'bg-slate-900 border-slate-700'}`}>
              <div className="flex items-center gap-3 mb-3">
                <Clock size={18} className={asset.status === 'expired' ? 'text-red-400' : asset.status === 'expiring' ? 'text-orange-400' : 'text-green-400'} />
                <span className="text-sm font-bold uppercase tracking-wider opacity-70">Lifecycle</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs opacity-50">Created</p>
                  <p className="text-sm font-bold">{formatDate(asset.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Expires</p>
                  <p className="text-sm font-bold">{formatDate(asset.expires_at)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Days Remaining</p>
                  <p className={`text-sm font-bold ${asset.days_until_expiry < 0 ? 'text-red-400' : asset.days_until_expiry <= 30 ? 'text-orange-400' : 'text-green-400'}`}>
                    {asset.days_until_expiry < 0 ? `${Math.abs(asset.days_until_expiry)}d overdue` : `${asset.days_until_expiry}d`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PROPERTIES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4">Properties</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div className="flex items-center gap-2">
                <Server size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Type</p>
                  <p className="text-sm">{asset.asset_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Vendor</p>
                  <p className="text-sm">{asset.vendor || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Serial Number</p>
                  <p className="text-sm font-mono">{asset.serial_number || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">IP Address</p>
                  <p className="text-sm font-mono">{asset.ip_address || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Linked Product</p>
                  <p className="text-sm">{asset.linked_product || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Auto Invoice</p>
                  <p className="text-sm">{asset.auto_invoice ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SPECS */}
          {specs && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
                <Cpu size={14} /> Specifications
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(specs).map(([key, value]) => (
                  <div key={key} className="bg-black/30 rounded-lg p-3">
                    <p className="text-[10px] uppercase opacity-50 font-bold">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-bold mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTES */}
          {asset.notes && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Notes</h3>
              <p className="text-sm leading-relaxed opacity-80 whitespace-pre-wrap">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* RIGHT — SIDEBAR */}
        <div className="space-y-6">

          {/* CLIENT CARD */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Client</h3>
            <button
              onClick={() => navigate(`/clients/${asset.account_id}`)}
              className="text-sanctum-gold hover:underline font-bold"
            >
              {asset.account_name}
            </button>
          </div>

          {/* LINKED TICKETS */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <Ticket size={14} /> Linked Tickets
            </h3>
            {asset.tickets.length === 0 ? (
              <p className="text-xs opacity-40">No tickets linked to this asset.</p>
            ) : (
              <div className="space-y-2">
                {asset.tickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">#{t.id}</span>
                      <span className={`text-[10px] uppercase font-bold ${ticketStatusColor(t.status)}`}>{t.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm mt-1 truncate">{t.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase ${priorityColor(t.priority)}`}>{t.priority}</span>
                      <span className="text-[10px] opacity-40">{formatDate(t.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* METADATA */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Metadata</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="opacity-50">Created</span>
                <span>{formatDate(asset.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Updated</span>
                <span>{formatDate(asset.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">ID</span>
                <span className="font-mono opacity-40 text-[10px]">{asset.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}