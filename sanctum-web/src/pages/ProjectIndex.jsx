import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
// FIX: Ensure 'X' is in this import list
import { Loader2, Plus, Briefcase, Calendar, X } from 'lucide-react';
import api from '../lib/api';

export default function ProjectIndex() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ account_id: '', name: '', budget: '', due_date: '' });

  useEffect(() => {
    const init = async () => {
      try {
        const [pRes, cRes] = await Promise.all([
            api.get('/projects'),
            api.get('/accounts')
        ]);
        setProjects(pRes.data);
        setClients(cRes.data);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    if (token) init();
  }, [token]);

const handleCreate = async (e) => {
      e.preventDefault();
      try {
          // SANITIZATION LAYER
          const payload = {
              account_id: form.account_id,
              name: form.name,
              // Convert string to float, default to 0 if empty
              budget: parseFloat(form.budget) || 0,
              // Convert empty string to null for Pydantic
              due_date: form.due_date ? form.due_date : null
          };

          const res = await api.post('/projects', payload);
          navigate(`/projects/${res.data.id}`);
      } catch (e) { 
          console.error("Creation Error:", e.response?.data);
          alert("Failed to create project. Check console for details."); 
      }
  };

  return (
    <Layout title="Project Governance">
      <div className="flex justify-end mb-6">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 shadow-lg">
          <Plus size={18} /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => navigate(`/projects/${p.id}`)}
            className="p-6 bg-slate-900 border border-slate-700 rounded-xl hover:border-sanctum-gold/50 cursor-pointer transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-black/30 rounded-lg">
                <Briefcase className="text-sanctum-gold" size={24} />
              </div>
              <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${p.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                {p.status}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-sanctum-gold transition-colors">{p.name}</h3>
            <p className="text-sm text-slate-400 mb-4">{p.account_name}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-2">
                <Calendar size={12} /> {p.due_date || 'No Deadline'}
              </span>
              <span>${p.budget.toLocaleString()}</span>
            </div>
          </div>
        ))}
        
        {projects.length === 0 && !loading && (
          <div className="col-span-3 p-12 text-center border border-dashed border-slate-700 rounded-xl opacity-50">
            No active projects.
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4">Initialize Project</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Client</label>
                        <select required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                            <option value="">Select...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Project Name</label>
                        <input required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Server Migration" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Budget ($)</label>
                            <input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Due Date</label>
                            <input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Create Project</button>
                </form>
            </div>
        </div>
      )}
    </Layout>
  );
}