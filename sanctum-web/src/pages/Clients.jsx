import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Building, Home, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Clients() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // MODAL STATE
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'business',
    brand_affinity: 'both', // Default
    status: 'prospect'
  });

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';
  const isGlobal = scope === 'global';
  const isSanctum = scope === 'ds_only';

  const tableHeadClass = isNaked ? "text-slate-500 bg-slate-100" : "text-sanctum-gold bg-slate-800";
  const rowClass = isNaked ? "border-slate-100 hover:bg-slate-50 text-slate-800" : "border-slate-800 hover:bg-white/5 text-slate-300";
  const btnClass = isNaked ? "bg-naked-pink hover:bg-pink-600 text-white" : "bg-sanctum-blue hover:bg-blue-600 text-white";
  const modalBg = isNaked ? "bg-white" : "bg-slate-900 border border-slate-700 text-white";
  const inputClass = isNaked ? "border-slate-300" : "bg-black/20 border-slate-700 text-white";

  useEffect(() => {
    fetchClients();
  }, [token]);

  const fetchClients = async () => {
    try {
      const response = await api.get('/accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClients(response.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Auto-set brand affinity based on user scope if not global
      let payload = { ...formData };
      if (isNaked) payload.brand_affinity = 'nt';
      if (isSanctum) payload.brand_affinity = 'ds';

      const response = await api.post('/accounts', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowModal(false);
      // Redirect to the new profile immediately
      navigate(`/clients/${response.data.id}`);
    } catch (error) {
      alert("Creation Failed: " + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <Layout title="Client Registry">

      {/* TOOLBAR */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-all hover:-translate-y-1 ${btnClass}`}
        >
          <Plus size={18} /> New Client
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 opacity-50"><Loader2 className="animate-spin" /> Fetching Database...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-opacity-20 border-gray-500">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-xs uppercase tracking-wider ${tableHeadClass}`}>
                <th className="p-4">Entity Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                {isGlobal && <th className="p-4">Brand</th>}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className={`border-b transition-colors ${rowClass}`}>
                  <td className="p-4 font-medium">{client.name}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-2 opacity-70">
                      {client.type === 'business' ? <Building size={14}/> : <Home size={14}/>}
                      {client.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      client.status === 'client' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  {isGlobal && <td className="p-4 opacity-50 uppercase text-xs">{client.brand_affinity}</td>}
                  <td className="p-4 text-right">
                    <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs font-bold opacity-50 hover:opacity-100 uppercase">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${modalBg}`}>
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>

            <h2 className="text-xl font-bold mb-6">Provision New Entity</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs uppercase opacity-70 block mb-1">Entity Name</label>
                <input
                  required
                  autoFocus
                  className={`w-full p-3 rounded border outline-none focus:ring-2 focus:ring-opacity-50 ${inputClass}`}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Type</label>
                  <select
                    className={`w-full p-3 rounded border outline-none ${inputClass}`}
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="business">Business</option>
                    <option value="residential">Residential</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Status</label>
                  <select
                    className={`w-full p-3 rounded border outline-none ${inputClass}`}
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="prospect">Prospect</option>
                    <option value="lead">Lead</option>
                    <option value="client">Client</option>
                  </select>
                </div>
              </div>

              {/* Only Global users can choose Brand Affinity */}
              {isGlobal && (
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Brand Sovereignty</label>
                  <select
                    className={`w-full p-3 rounded border outline-none ${inputClass}`}
                    value={formData.brand_affinity}
                    onChange={e => setFormData({...formData, brand_affinity: e.target.value})}
                  >
                    <option value="both">Shared (Both)</option>
                    <option value="ds">Digital Sanctum Only</option>
                    <option value="nt">Naked Tech Only</option>
                  </select>
                </div>
              )}

              <button type="submit" className={`w-full py-3 mt-4 rounded font-bold ${btnClass}`}>
                Confirm Provisioning
              </button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}
