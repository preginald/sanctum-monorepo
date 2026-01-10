import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, ArrowRight, Shield } from 'lucide-react';
import api from '../lib/api';

export default function Clients() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'business', brand_affinity: 'ds' });

  const isAdmin = user?.role !== 'client';

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/accounts');
        setAccounts(response.data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    if (token) fetchAccounts();
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts', form);
      setShowModal(false);
      window.location.reload(); 
    } catch (e) { alert("Failed to create client"); }
  };

  return (
    <Layout title="Client Registry">
      <div className="flex justify-end mb-6">
        {isAdmin && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 shadow-lg transition-transform hover:-translate-y-1">
            <Plus size={18} /> New Client
            </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-xs uppercase text-slate-400 font-bold tracking-wider">
            <tr>
              <th className="p-4">Client Name</th>
              <th className="p-4">Type</th>
              <th className="p-4">Brand</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm text-white divide-y divide-slate-800">
            {accounts.map(account => (
              <tr 
                key={account.id} 
                onClick={() => navigate(`/clients/${account.id}`)}
                className="hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <td className="p-4 font-bold text-base group-hover:text-sanctum-gold transition-colors">
                    {account.name}
                </td>
                <td className="p-4 capitalize opacity-70">{account.type}</td>
                <td className="p-4">
                  {account.brand_affinity === 'ds' && <span className="text-sanctum-gold font-bold">SANCTUM</span>}
                  {account.brand_affinity === 'nt' && <span className="text-pink-500 font-bold">NAKED</span>}
                  {account.brand_affinity === 'both' && <span className="opacity-50">SHARED</span>}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${account.status === 'client' ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                    {account.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && !loading && <div className="p-8 text-center opacity-50">No clients found.</div>}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
            <h2 className="text-xl font-bold mb-4">Onboard Entity</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs uppercase opacity-50 block mb-1">Entity Name</label>
                <input required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Type</label>
                    <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                        <option value="business">Business</option>
                        <option value="residential">Residential</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Brand</label>
                    <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.brand_affinity} onChange={e => setForm({...form, brand_affinity: e.target.value})}>
                        <option value="ds">Digital Sanctum</option><option value="nt">Naked Tech</option><option value="both">Shared</option>
                    </select>
                  </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-700 rounded text-white">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Initialize</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}