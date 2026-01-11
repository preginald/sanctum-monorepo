import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Plus, CheckCircle, Circle, Receipt, Calendar, Flag, Activity, Bug, Zap, Clipboard, X, Edit2 } from 'lucide-react';
import api from '../lib/api';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // MODALS
  const [showMsModal, setShowMsModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  
  // FORMS
  const [editingMsId, setEditingMsId] = useState(null); // Track if editing
  const [msForm, setMsForm] = useState({ name: '', billable_amount: '', due_date: '', sequence: 1 });
  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'normal', ticket_type: 'task', milestone_id: '' });

  useEffect(() => { fetchProject(); }, [id]);

  const fetchProject = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get('/tickets') 
      ]);
      // Sort Milestones by Sequence
      pRes.data.milestones.sort((a, b) => a.sequence - b.sequence);
      setProject(pRes.data);
      setTickets(tRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // --- ACTIONS ---

  const handleSaveMilestone = async (e) => {
      e.preventDefault();
      try {
          const payload = {
              name: msForm.name,
              billable_amount: parseFloat(msForm.billable_amount) || 0,
              sequence: parseInt(msForm.sequence) || 1,
              due_date: msForm.due_date ? msForm.due_date : null
          };

          if (editingMsId) {
              await api.put(`/milestones/${editingMsId}`, payload);
          } else {
              await api.post(`/projects/${id}/milestones`, payload);
          }
          
          closeMsModal();
          fetchProject();
      } catch(e) { alert("Failed to save milestone."); }
  };

  const handleCreateTicket = async (e) => {
      e.preventDefault();
      try {
          await api.post('/tickets', { 
              ...ticketForm, 
              account_id: project.account_id 
          });
          setShowTicketModal(false);
          setTicketForm({ subject: '', priority: 'normal', ticket_type: 'task', milestone_id: '' });
          fetchProject();
      } catch (e) { alert("Failed to create ticket"); }
  };

  const updateMilestoneStatus = async (msId, newStatus) => {
      try {
          await api.put(`/milestones/${msId}`, { status: newStatus });
          fetchProject();
      } catch(e) { alert("Status update failed"); }
  };

  const generateInvoice = async (msId) => {
      if(!confirm("Generate Invoice for this Milestone?")) return;
      try {
          await api.post(`/milestones/${msId}/invoice`);
          fetchProject();
          alert("Invoice created in Client Ledger.");
      } catch(e) { alert(e.response?.data?.detail || "Error"); }
  };

  // --- HELPERS ---

  const openNewMsModal = () => {
      setEditingMsId(null);
      // Auto-increment sequence logic
      const nextSeq = project.milestones.length > 0 
        ? Math.max(...project.milestones.map(m => m.sequence)) + 1 
        : 1;
      setMsForm({ name: '', billable_amount: '', due_date: '', sequence: nextSeq });
      setShowMsModal(true);
  };

  const openEditMsModal = (ms) => {
      setEditingMsId(ms.id);
      setMsForm({
          name: ms.name,
          billable_amount: ms.billable_amount,
          due_date: ms.due_date || '',
          sequence: ms.sequence
      });
      setShowMsModal(true);
  };

  const closeMsModal = () => {
      setShowMsModal(false);
      setEditingMsId(null);
  }

  const openTicketModal = (msId) => {
      setTicketForm({ 
          subject: '', 
          priority: 'normal', 
          ticket_type: 'task', 
          milestone_id: msId 
      });
      setShowTicketModal(true);
  };

  const getTicketsForMilestone = (msId) => tickets.filter(t => t.milestone_id === msId);

  const getIconForType = (type) => {
      if (type === 'bug') return <Bug size={14} className="text-red-400" />;
      if (type === 'feature') return <Zap size={14} className="text-yellow-400" />;
      return <Activity size={14} className="text-blue-400" />;
  };

  if (loading || !project) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

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
        <button onClick={openNewMsModal} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold">
            <Plus size={16}/> Add Milestone
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: STATUS */}
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
                          <div key={ms.id} className="p-4 bg-black/20 rounded border border-white/5">
                              <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-4">
                                      {/* SEQUENCE BADGE */}
                                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-600">
                                          {ms.sequence}
                                      </div>
                                      
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className={`font-bold ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{ms.name}</h4>
                                              <button onClick={() => openEditMsModal(ms)} className="text-slate-500 hover:text-sanctum-gold"><Edit2 size={12}/></button>
                                          </div>
                                          <p className="text-xs opacity-50">Due: {ms.due_date || 'TBD'} • ${ms.billable_amount.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                      <select className="bg-slate-800 border border-slate-600 text-xs rounded p-1 text-white uppercase font-bold" value={ms.status} onChange={(e) => updateMilestoneStatus(ms.id, e.target.value)} disabled={!!ms.invoice_id}>
                                          <option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option>
                                      </select>

                                      <button onClick={() => openTicketModal(ms.id)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white" title="Add Task">
                                          <Plus size={14} />
                                      </button>

                                      {!ms.invoice_id ? (
                                          <button onClick={() => generateInvoice(ms.id)} className="flex items-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"><Receipt size={14} /> Bill Now</button>
                                      ) : (
                                          <span className="flex items-center gap-2 text-xs font-bold text-green-500 border border-green-500/30 px-3 py-1 rounded bg-green-500/10"><Receipt size={14} /> BILLED</span>
                                      )}
                                  </div>
                              </div>

                              <div className="mt-4 pl-10 border-l-2 border-slate-800 space-y-2">
                                  {getTicketsForMilestone(ms.id).map(t => (
                                      <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="flex justify-between items-center p-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-800 transition-colors group">
                                          <div className="flex items-center gap-2">
                                              {getIconForType(t.ticket_type)}
                                              <span className={`text-sm ${t.status === 'resolved' ? 'line-through opacity-50' : ''}`}>{t.subject}</span>
                                          </div>
                                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${t.priority === 'critical' ? 'bg-red-900 text-red-400' : 'bg-slate-700 text-slate-400'}`}>{t.status}</span>
                                      </div>
                                  ))}
                                  {getTicketsForMilestone(ms.id).length === 0 && <div className="text-xs opacity-30 italic">No tickets linked.</div>}
                              </div>
                          </div>
                      ))}
                      {project.milestones.length === 0 && <div className="text-center opacity-30 italic">No milestones defined.</div>}
                  </div>
              </div>
          </div>
      </div>

      {/* MILESTONE MODAL */}
      {showMsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm relative">
                <button onClick={closeMsModal} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-lg font-bold mb-4">{editingMsId ? 'Edit Milestone' : 'Add Milestone'}</h2>
                <form onSubmit={handleSaveMilestone} className="space-y-3">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Sequence</label>
                        <input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.sequence} onChange={e => setMsForm({...msForm, sequence: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Name</label>
                        <input required placeholder="Name (e.g. Prototype)" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.name} onChange={e => setMsForm({...msForm, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Billable Value ($)</label>
                        <input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.billable_amount} onChange={e => setMsForm({...msForm, billable_amount: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Target Date</label>
                        <input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.due_date} onChange={e => setMsForm({...msForm, due_date: e.target.value})} />
                    </div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold rounded text-sm text-slate-900 font-bold mt-2">
                        {editingMsId ? 'Save Changes' : 'Create Milestone'}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
                <button onClick={() => setShowTicketModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clipboard size={20} className="text-sanctum-gold"/> Add Task
                </h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Type</label>
                            <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={ticketForm.ticket_type} onChange={e => setTicketForm({...ticketForm, ticket_type: e.target.value})}>
                                <option value="task">Task</option>
                                <option value="bug">Bug</option>
                                <option value="feature">Feature</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Priority</label>
                            <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Subject</label>
                        <input autoFocus required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} placeholder="e.g. Design Database Schema" />
                    </div>

                    {/* NEW: DESCRIPTION INPUT */}
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Description</label>
                        <textarea 
                            className="w-full p-2 h-24 rounded bg-black/40 border border-slate-600 text-white text-sm" 
                            value={ticketForm.description || ''} 
                            onChange={e => setTicketForm({...ticketForm, description: e.target.value})} 
                            placeholder="Task details..." 
                        />
                    </div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Create Task</button>
                </form>
            </div>
        </div>
      )}

    </Layout>
  );
}