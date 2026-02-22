import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, Shield } from 'lucide-react';
import api from '../lib/api';

// UI KIT
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import KanbanBoard from '../components/ui/KanbanBoard';
import Modal from '../components/ui/Modal'; // Use generic modal

const STAGES = {
  'Infiltration': { id: 'Infiltration', label: 'Infiltration', prob: 10, color: 'border-slate-500' },
  'Filtration': { id: 'Filtration', label: 'Filtration', prob: 30, color: 'border-blue-500' },
  'Diagnosis': { id: 'Diagnosis', label: 'Diagnosis', prob: 50, color: 'border-yellow-500' },
  'Prescription': { id: 'Prescription', label: 'Prescription', prob: 80, color: 'border-purple-500' },
  'Accession': { id: 'Accession', label: 'Accession', prob: 100, color: 'border-green-500' },
};

export default function Deals() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [deals, setDeals] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ account_id: '', title: '', amount: 0 });

  useEffect(() => { fetchDeals(); }, [token, refreshKey]);

  const fetchDeals = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
          api.get('/deals'),
          api.get('/accounts')
      ]);
      setDeals(dRes.data);
      setClients(cRes.data);
      calculateTotal(dRes.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const calculateTotal = (data) => {
    const total = data.reduce((sum, deal) => sum + (deal.amount * (deal.probability / 100)), 0);
    setTotalValue(total);
  };

  const onDragEnd = async (result) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === result.source.droppableId && destination.index === result.source.index) return;

    const newStage = destination.droppableId;
    const newProb = STAGES[newStage].prob;

    const updatedDeals = deals.map(d => d.id === draggableId ? { ...d, stage: newStage, probability: newProb } : d);
    setDeals(updatedDeals);
    calculateTotal(updatedDeals);

    try { await api.put(`/deals/${draggableId}`, { stage: newStage, probability: newProb }); } 
    catch (err) { alert("Move failed"); fetchDeals(); }
  };

  const handleCreate = async (e) => {
      e.preventDefault();
      try {
          // Defaults
          const payload = { ...form, stage: 'Infiltration', probability: 10 };
          await api.post('/deals', payload);
          setShowModal(false);
          setForm({ account_id: '', title: '', amount: 0 });
          fetchDeals();
      } catch(e) { alert("Failed to create deal"); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="Revenue Pipeline">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm opacity-50 uppercase tracking-widest">Weighted Forecast</p>
          <h2 className="text-3xl font-bold text-sanctum-gold">{formatCurrency(totalValue)}</h2>
        </div>
        <Button variant="gold" icon={Plus} onClick={() => setShowModal(true)}>New Deal</Button>
      </div>

      <KanbanBoard 
        columns={STAGES}
        items={deals}
        statusField="stage"
        onDragEnd={onDragEnd}
        renderCard={(deal) => (
            <div 
                onClick={() => navigate(`/deals/${deal.id}`)}
                className="p-4 rounded-xl bg-slate-800 border border-slate-600 shadow-sm hover:border-sanctum-gold transition-all cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">{deal.account_name}</span>
                    <Shield size={14} className="text-blue-500" />
                </div>
                <h4 className="font-bold text-base mb-1 group-hover:text-sanctum-gold transition-colors">{deal.title}</h4>
                <div className="flex justify-between items-end mt-4">
                    <span className="text-white font-mono text-lg font-bold">${deal.amount.toLocaleString()}</span>
                    <span className="text-xs opacity-50">{deal.probability}%</span>
                </div>
            </div>
        )}
      />

      {/* CREATE MODAL */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Initialize Deal">
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                  <label className="text-xs opacity-50 block mb-1">Client</label>
                  <select required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                      <option value="">Select...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <input required placeholder="Deal Title" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <input type="number" required placeholder="Value ($)" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              <Button type="submit" className="w-full">Create</Button>
          </form>
      </Modal>

    </Layout>
  );
}