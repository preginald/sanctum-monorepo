import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { handleSmartWrap } from '../lib/textUtils';
// FIX: Added 'Flag' to imports
import { Loader2, ArrowLeft, Plus, CheckCircle, Circle, Receipt, Calendar, Flag, Activity, Bug, Zap, Clipboard, X, Edit2, ChevronUp, ChevronDown, Briefcase } from 'lucide-react';
import api from '../lib/api';

// COMPONENTS
import ProjectHeader from '../components/projects/ProjectHeader';
import ProjectStats from '../components/projects/ProjectStats';
import TicketList from '../components/tickets/TicketList';

import { TICKET_TYPES, TICKET_PRIORITIES } from '../lib/constants';
import { TicketTypeIcon, StatusBadge } from '../components/tickets/TicketBadges';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tickets, setTickets] = useState([]); 
  const [loading, setLoading] = useState(true);
  // PERSISTED STATE
const [showCompletedMs, setShowCompletedMs] = useState(() => {
    return localStorage.getItem('sanctum_show_completed_ms') === 'true';
});

const toggleShowCompleted = (e) => {
    const val = e.target.checked;
    setShowCompletedMs(val);
    localStorage.setItem('sanctum_show_completed_ms', val);
};

  // MODALS
  const [showMsModal, setShowMsModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingMsId, setEditingMsId] = useState(null); 
  const [msForm, setMsForm] = useState({ name: '', billable_amount: '', due_date: '', sequence: 1 });
  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'normal', ticket_type: 'task', milestone_id: '' });

  useEffect(() => { fetchProject(); }, [id]);

  const fetchProject = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
          api.get(`/projects/${id}`),
          api.get('/tickets') 
      ]);
      if (pRes.data.milestones) pRes.data.milestones.sort((a, b) => a.sequence - b.sequence);
      setProject(pRes.data);
      setTickets(tRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // --- ACTIONS ---
  const handleSaveMilestone = async (e) => { e.preventDefault(); try { const p = { name: msForm.name, billable_amount: parseFloat(msForm.billable_amount)||0, sequence: parseInt(msForm.sequence)||1, due_date: msForm.due_date||null }; if(editingMsId) await api.put(`/milestones/${editingMsId}`, p); else await api.post(`/projects/${id}/milestones`, p); setShowMsModal(false); fetchProject(); } catch(e){ alert("Failed"); } };
  const handleCreateTicket = async (e) => { e.preventDefault(); try { await api.post('/tickets', {...ticketForm, account_id: project.account_id}); setShowTicketModal(false); fetchProject(); } catch(e){ alert("Failed"); } };
  const updateMilestoneStatus = async (mid, st) => { try { await api.put(`/milestones/${mid}`, {status:st}); fetchProject(); } catch(e){ alert("Failed"); } };
  const generateInvoice = async (mid) => { if(!confirm("Bill?")) return; try { await api.post(`/milestones/${mid}/invoice`); fetchProject(); alert("Billed."); } catch(e){ alert("Error"); } };

  const moveMilestone = async (index, direction) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= project.milestones.length) return;
      const newMilestones = [...project.milestones];
      [newMilestones[index], newMilestones[newIndex]] = [newMilestones[newIndex], newMilestones[index]];
      newMilestones.forEach((m, idx) => m.sequence = idx + 1);
      setProject({ ...project, milestones: newMilestones });
      try { await api.post(`/projects/${id}/milestones/reorder`, { items: newMilestones.map(m => ({ id: m.id, sequence: m.sequence })) }); } catch(e) { fetchProject(); }
  };

  // --- HELPERS ---
  const getTicketsForMilestone = (msId) => tickets.filter(t => t.milestone_id === msId);

  if (loading || !project) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  const completedCount = project?.milestones?.filter(m => m.status === 'completed').length || 0;

  const visibleMilestones = project?.milestones?.filter(ms => 
    showCompletedMs ? true : ms.status !== 'completed'
  ) || [];

  return (
    <Layout title="Mission Control">
      <ProjectHeader project={project} onAddMilestone={() => { setEditingMsId(null); setMsForm({name:'', billable_amount:'', due_date:'', sequence: project.milestones.length+1}); setShowMsModal(true); }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
              <ProjectStats project={project} />
          </div>

        <div className="lg:col-span-2">
              {/* MILESTONE LIST */}
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  {/* HEADER WITH TOGGLE */}
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                          <Flag size={16} /> Milestones & Billing
                      </h3>
                      
                      <div className="flex items-center gap-4">
                      {/* SHOW COMPLETED TOGGLE */}
                      <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 cursor-pointer hover:text-white transition-colors select-none">
                          <span>Show History {(!showCompletedMs && completedCount > 0) && <span className="text-slate-600">({completedCount})</span>}</span>
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showCompletedMs ? 'bg-blue-600' : 'bg-slate-700'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showCompletedMs ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                          <input type="checkbox" className="hidden" checked={showCompletedMs} onChange={toggleShowCompleted} />
                      </label>

                          <button onClick={() => { setEditingMsId(null); setMsForm({name:'', billable_amount:'', due_date:'', sequence: project.milestones.length+1}); setShowMsModal(true); }} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors">
                              <Plus size={16} />
                          </button>
                      </div>
                  </div>

                  <div className="space-y-4">
                      {visibleMilestones.length > 0 ? visibleMilestones.map((ms, index) => (
                          <div key={ms.id} className="p-4 bg-black/20 rounded border border-white/5">
                              <div className="flex justify-between items-start mb-4">
                                  {/* ... (Existing Milestone Row Content remains unchanged) ... */}
                                  <div className="flex items-center gap-4">
                                      <div className="flex flex-col gap-0.5 mr-2">
                                          <button onClick={() => moveMilestone(index, -1)} className="text-slate-600 hover:text-white"><ChevronUp size={12}/></button>
                                          <button onClick={() => moveMilestone(index, 1)} className="text-slate-600 hover:text-white"><ChevronDown size={12}/></button>
                                      </div>
                                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-600">{ms.sequence}</div>
                                      <div>
                                          <div className="flex items-center gap-2">
                                              <h4 className={`font-bold ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{ms.name}</h4>
                                              <button onClick={() => { setEditingMsId(ms.id); setMsForm(ms); setShowMsModal(true); }} className="text-slate-500 hover:text-sanctum-gold"><Edit2 size={12}/></button>
                                          </div>
                                          <p className="text-xs opacity-50">Due: {ms.due_date || 'TBD'} • ${ms.billable_amount.toLocaleString()}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <select className="bg-slate-800 border border-slate-600 text-xs rounded p-1 text-white uppercase font-bold" value={ms.status} onChange={(e) => updateMilestoneStatus(ms.id, e.target.value)} disabled={!!ms.invoice_id}><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option></select>
                                      {!ms.invoice_id ? <button onClick={() => generateInvoice(ms.id)} className="flex items-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"><Receipt size={14} /> Bill Now</button> : <span className="flex items-center gap-2 text-xs font-bold text-green-500 border border-green-500/30 px-3 py-1 rounded bg-green-500/10"><Receipt size={14} /> BILLED</span>}
                                  </div>
                              </div>
                              <div className="mt-4 pl-4 border-l-2 border-slate-800">
                                <TicketList 
                                    tickets={getTicketsForMilestone(ms.id)}
                                    embedded={true} 
                                    onAdd={() => {
                                        setTicketForm({...ticketForm, milestone_id: ms.id}); 
                                        setShowTicketModal(true); 
                                    }}
                                />
                            </div>
                          </div>
                      )) : (
                          <p className="text-sm opacity-30 italic text-center py-8">
                              {showCompletedMs ? "No milestones found." : "No active milestones. Toggle 'Show Completed' to see history."}
                          </p>
                      )}
                  </div>
              </div>
          </div>
      </div>
      
      {/* MODALS */}
      {showMsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm relative">
                <button onClick={() => setShowMsModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-lg font-bold mb-4">{editingMsId ? 'Edit Milestone' : 'Add Milestone'}</h2>
                <form onSubmit={handleSaveMilestone} className="space-y-3">
                    <div><label className="text-xs opacity-50 block mb-1">Sequence</label><input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.sequence} onChange={e => setMsForm({...msForm, sequence: e.target.value})} /></div>
                    <div><label className="text-xs opacity-50 block mb-1">Name</label><input required placeholder="Name" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.name} onChange={e => setMsForm({...msForm, name: e.target.value})} /></div>
                    <div><label className="text-xs opacity-50 block mb-1">Billable Value ($)</label><input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.billable_amount} onChange={e => setMsForm({...msForm, billable_amount: e.target.value})} /></div>
                    <div><label className="text-xs opacity-50 block mb-1">Target Date</label><input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.due_date} onChange={e => setMsForm({...msForm, due_date: e.target.value})} /></div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold rounded text-sm text-slate-900 font-bold mt-2">Save</button>
                </form>
            </div>
        </div>
      )}

      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
                <button onClick={() => setShowTicketModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Clipboard size={20} className="text-sanctum-gold"/> Add Task</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
    <div>
        <label className="text-xs opacity-50 block mb-1">Type</label>
        <select 
            className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize" 
            value={ticketForm.ticket_type} 
            onChange={e => setTicketForm({...ticketForm, ticket_type: e.target.value})}
        >
            {TICKET_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
            ))}
        </select>
    </div>
    <div>
        <label className="text-xs opacity-50 block mb-1">Priority</label>
        <select 
            className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize" 
            value={ticketForm.priority} 
            onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}
        >
            {TICKET_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{priority}</option>
            ))}
        </select>
    </div>
</div>
                    <div><label className="text-xs opacity-50 block mb-1">Subject</label><input autoFocus required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} /></div>
                    <div><label className="text-xs opacity-50 block mb-1">Description</label><textarea 
                        className="w-full p-2 h-24 rounded bg-black/40 border border-slate-600 text-white text-sm font-mono" 
                        value={ticketForm.description} 
                        onChange={e => setTicketForm({...ticketForm, description: e.target.value})}
                        // NEW: Smart Wrap Logic
                        onKeyDown={(e) => handleSmartWrap(e, ticketForm.description, (v) => setTicketForm({...ticketForm, description: v}))}
                    /></div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Create Task</button>
                </form>
            </div>
        </div>
      )}
    </Layout>
  );
}