import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, ArrowLeft, Save, Edit2, DollarSign, Calendar, BarChart3, Building } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    amount: 0,
    stage: '',
    probability: 0
  });

  useEffect(() => { fetchDeal(); }, [id]);

  const fetchDeal = async () => {
    try {
      const res = await api.get(`/deals/${id}`);
      setDeal(res.data);
      setFormData({
        title: res.data.title,
        amount: res.data.amount,
        stage: res.data.stage,
        probability: res.data.probability
      });
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      await api.put(`/deals/${id}`, formData);
      await fetchDeal(); 
      setIsEditing(false); 
      addToast("Deal updated successfully", "success");
    } catch (e) { addToast("Update failed", "danger"); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  if (loading || !deal) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title="Deal Intelligence">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/deals')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <p className="opacity-50 text-sm flex items-center gap-2">
              <Building size={12} /> {deal.account_name}
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors">
            <Edit2 size={16} /> Edit Deal
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold">
              <Save size={16} /> Save Changes
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: DEAL DATA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative">
            
            {/* READ MODE */}
            {!isEditing && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Stage</label>
                    <span className="px-3 py-1 rounded text-sm font-bold uppercase bg-blue-900/30 text-blue-400 border border-blue-500/30">
                      {deal.stage}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Probability</label>
                    <span className="text-xl font-bold">{deal.probability}%</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <label className="text-xs uppercase opacity-50 block mb-1">Value</label>
                  <span className="text-3xl font-bold text-sanctum-gold">{formatCurrency(deal.amount)}</span>
                </div>
              </div>
            )}

            {/* EDIT MODE */}
            {isEditing && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs uppercase opacity-50 mb-1">Deal Title</label>
                  <input className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase opacity-50 mb-1">Stage</label>
                    <select className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none" value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value})}>
                      <option>Infiltration</option><option>Filtration</option><option>Diagnosis</option><option>Prescription</option><option>Accession</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase opacity-50 mb-1">Probability (%)</label>
                    <input type="number" className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none" value={formData.probability} onChange={e => setFormData({...formData, probability: parseInt(e.target.value)})} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs uppercase opacity-50 mb-1">Value ($)</label>
                  <input type="number" className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none text-xl" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT: Comment Stream */}
        <div className="h-[600px]">
          <CommentStream resourceType="deal" resourceId={deal.id} />
        </div>
      </div>
    </Layout>
  );
}
