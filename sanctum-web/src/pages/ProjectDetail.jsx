import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Plus, CheckCircle, Circle, Receipt, Calendar, Flag } from 'lucide-react';
import api from '../lib/api';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Milestone Modal
  const [showModal, setShowModal] = useState(false);
  const [msForm, setMsForm] = useState({ name: '', billable_amount: '', due_date: '' });

  useEffect(() => { fetchProject(); }, [id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // --- FIX APPLIED HERE ---
  const handleCreateMilestone = async (e) => {
      e.preventDefault();
      try {
          // SANITIZATION LAYER
          const payload = {
              name: msForm.name,
              // Convert string to float, default to 0
              billable_amount: parseFloat(msForm.billable_amount) || 0,
              // Convert empty string to null
              due_date: msForm.due_date ? msForm.due_date : null
          };

          await api.post(`/projects/${id}/milestones`, payload);
          setShowModal(false);
          setMsForm({ name: '', billable_amount: '', due_date: '' });
          fetchProject();
      } catch(e) { 
          console.error(e);
          alert("Failed to create milestone. Check inputs."); 
      }
  };

  const generateInvoice = async (msId) => {
      if(!confirm("Generate Invoice for this Milestone?")) return;
      try {
          await api.post(`/milestones/${msId}/invoice`);
          fetchProject();
          alert("Invoice created in Client Ledger.");
      } catch(e) { alert(e.response?.data?.detail || "Error"); }
  };

  if (loading || !project) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  // Burn Down Calc
  const totalBilled = project.milestones.reduce((sum, m) => m.invoice_id ? sum + m.billable_amount : sum, 0);
  const percentUsed = project.budget > 0 ? Math.min(100, (totalBilled / project.budget) * 100) : 0;

  return (
    <Layout title="Mission Control">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="opacity-50 text-sm flex items-center gap-2">
              {project.account_name} • {project.status.toUpperCase()}
            </p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold">
            <Plus size={16}/> Add Milestone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: STATUS & BUDGET */}
          <div className="space-y-6">
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Budget Burn Down</h3>
                  <div className="mb-2 flex justify-between text-sm">
                      <span className="text-green-400">${totalBilled.toLocaleString()} Billed</span>
                      <span className="opacity-50">of ${project.budget.toLocaleString()}</span>
                  </div>
                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-sanctum-gold" style={{ width: `${percentUsed}%` }}></div>
                  </div>
              </div>

              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Timeline</h3>
                  <div className="flex items-center gap-3 text-sm mb-2">
                      <Calendar size={16} className="text-sanctum-gold"/> 
                      <span>Due: {project.due_date || "TBD"}</span>
                  </div>
              </div>
          </div>

          {/* RIGHT: MILESTONES */}
          <div className="lg:col-span-2">
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-6 flex items-center gap-2">
                      <Flag size={16} /> Milestones & Billing
                  </h3>
                  <div className="space-y-4">
                      {project.milestones.map(ms => (
                          <div key={ms.id} className="p-4 bg-black/20 rounded border border-white/5 flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                  {ms.status === 'completed' ? (
                                      <CheckCircle className="text-green-500" size={24} />
                                  ) : (
                                      <Circle className="text-slate-600" size={24} />
                                  )}
                                  <div>
                                      <h4 className={`font-bold ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{ms.name}</h4>
                                      <p className="text-xs opacity-50">Target: {ms.due_date || 'None'} • Value: ${ms.billable_amount.toLocaleString()}</p>
                                  </div>
                              </div>
                              
                              <div>
                                  {ms.invoice_id ? (
                                      <span className="flex items-center gap-2 text-xs font-bold text-green-500 border border-green-500/30 px-3 py-1 rounded bg-green-500/10">
                                          <Receipt size={14} /> INVOICED
                                      </span>
                                  ) : (
                                      <button 
                                        onClick={() => generateInvoice(ms.id)}
                                        className="flex items-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                                      >
                                          <Receipt size={14} /> Bill Now
                                      </button>
                                  )}
                              </div>
                          </div>
                      ))}
                      {project.milestones.length === 0 && <div className="text-center opacity-30 italic">No milestones defined.</div>}
                  </div>
              </div>
          </div>

      </div>

      {/* CREATE MILESTONE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4">Add Milestone</h2>
                <form onSubmit={handleCreateMilestone} className="space-y-3">
                    <input required placeholder="Name (e.g. Prototype)" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.name} onChange={e => setMsForm({...msForm, name: e.target.value})} />
                    <input required type="number" placeholder="Billable Amount ($)" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.billable_amount} onChange={e => setMsForm({...msForm, billable_amount: e.target.value})} />
                    <input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.due_date} onChange={e => setMsForm({...msForm, due_date: e.target.value})} />
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-700 rounded text-sm text-white">Cancel</button>
                        <button type="submit" className="flex-1 py-2 bg-sanctum-gold rounded text-sm text-slate-900 font-bold">Add</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </Layout>
  );
}