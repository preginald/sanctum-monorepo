import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { handleSmartWrap } from '../lib/textUtils';
import {
  Loader2, Plus, Receipt, Calendar, Flag, Clipboard,
  X, Edit2, ChevronUp, ChevronDown, CheckCircle, Circle,
  BarChart2, Layers
} from 'lucide-react';
import api from '../lib/api';

import ProjectStats from '../components/projects/ProjectStats';
import TicketList from '../components/tickets/TicketList';
import MetadataStrip from '../components/ui/MetadataStrip';

import { TICKET_TYPES, TICKET_PRIORITIES } from '../lib/constants';
import { TicketTypeIcon } from '../components/tickets/TicketBadges';
import { projectStatusStyles } from '../lib/statusStyles';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

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
  const [msForm, setMsForm] = useState({ name: '', description: '', billable_amount: '', due_date: '', sequence: 1 });
  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'normal', ticket_type: 'task', milestone_id: '' });

  // STICKY NAV
  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;
    const handleScroll = () => setIsScrolled(scrollContainer.scrollTop > 60);
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { fetchProject(); }, [id]);

  const fetchProject = async () => {
    try {
      const pRes = await api.get(`/projects/${id}`);
      if (pRes.data.milestones) pRes.data.milestones.sort((a, b) => a.sequence - b.sequence);
      setProject(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // --- ACTIONS ---
  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    try {
      const p = {
        name: msForm.name,
        description: msForm.description || null,
        billable_amount: parseFloat(msForm.billable_amount) || 0,
        sequence: parseInt(msForm.sequence) || 1,
        due_date: msForm.due_date || null
      };
      if (editingMsId) await api.put(`/milestones/${editingMsId}`, p);
      else await api.post(`/projects/${id}/milestones`, p);
      setShowMsModal(false);
      fetchProject();
    } catch (e) { alert("Failed"); }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tickets', { ...ticketForm, account_id: project.account_id });
      setShowTicketModal(false);
      fetchProject();
    } catch (e) { alert("Failed"); }
  };

  const updateMilestoneStatus = async (mid, st) => {
    try { await api.put(`/milestones/${mid}`, { status: st }); fetchProject(); }
    catch (e) { alert("Failed"); }
  };

  const generateInvoice = async (mid) => {
    if (!confirm("Bill this milestone?")) return;
    try { await api.post(`/milestones/${mid}/invoice`); fetchProject(); alert("Billed."); }
    catch (e) { alert("Error"); }
  };

  const moveMilestone = async (msId, direction) => {
    if (!project?.milestones) return;
    const milestones = [...project.milestones];
    const currentIndex = milestones.findIndex(m => m.id === msId);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= milestones.length) return;
    [milestones[currentIndex], milestones[newIndex]] = [milestones[newIndex], milestones[currentIndex]];
    milestones.forEach((m, idx) => m.sequence = idx + 1);
    setProject({ ...project, milestones });
    try {
      await api.post(`/projects/${id}/milestones/reorder`, {
        items: milestones.map(m => ({ id: m.id, sequence: m.sequence }))
      });
    } catch (e) { console.error("Reorder failed", e); fetchProject(); }
  };

  // --- HELPERS ---
  const getTicketsForMilestone = (msId) => project?.milestones?.find(m => m.id === msId)?.tickets || [];

  const getMilestoneProgress = (ms) => {
    const tickets = ms.tickets || [];
    if (tickets.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = tickets.filter(t => t.status === 'resolved').length;
    return { done, total: tickets.length, pct: Math.round((done / tickets.length) * 100) };
  };

  const milestoneStatusColor = (s) => {
    const map = {
      pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return map[s] || 'bg-white/10 text-slate-300';
  };

  if (loading || !project) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  // --- DERIVED STATS ---
  const allTickets = project.milestones?.flatMap(m => m.tickets || []) || [];
  const totalTickets = allTickets.length;
  const resolvedTickets = allTickets.filter(t => t.status === 'resolved').length;
  const openTickets = totalTickets - resolvedTickets;
  const completedMs = project.milestones?.filter(m => m.status === 'completed').length || 0;
  const totalMs = project.milestones?.length || 0;
  const totalBilled = project.milestones?.reduce((sum, m) => m.invoice_id ? sum + parseFloat(m.billable_amount || 0) : sum, 0) || 0;
  const totalBillable = project.milestones?.reduce((sum, m) => sum + parseFloat(m.billable_amount || 0), 0) || 0;
  const overallPct = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

  const visibleMilestones = project.milestones?.filter(ms =>
    showCompletedMs ? true : ms.status !== 'completed'
  ) || [];

  const hiddenCount = project.milestones?.filter(m => m.status === 'completed').length || 0;

  return (
    <Layout
      title={project.name}

      breadcrumb={[
        { label: project.account_name, path: `/clients/${project.account_id}` },
        { label: 'Projects', path: '/projects' },
      ]}
      onRefresh={fetchProject}
      onCopyMeta={() => `${project.name}\nClient: ${project.account_name}\nStatus: ${project.status}\nMilestones: ${totalMs}`}
      actions={
        <button
          onClick={() => { setEditingMsId(null); setMsForm({ name: '', description: '', billable_amount: '', due_date: '', sequence: project.milestones.length + 1 }); setShowMsModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold text-sm"
        >
          <Plus size={16} /> Add Milestone
        </button>
      }
    >

      {/* STICKY NAV */}
      <div className={`fixed top-16 left-0 right-0 z-20 transition-all duration-200 ${isScrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-2 flex items-center justify-between">
          <span className="text-sm font-bold truncate text-white">
            <span className="text-sanctum-gold mr-2">{project.account_name}</span>
            {project.name}
          </span>
          <button
            onClick={() => { setEditingMsId(null); setMsForm({ name: '', description: '', billable_amount: '', due_date: '', sequence: project.milestones.length + 1 }); setShowMsModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-sanctum-gold text-slate-900 rounded font-bold text-xs shrink-0"
          >
            <Plus size={14} /> Add Milestone
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* PRIMARY COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* HEALTH SUMMARY */}
          <div className="p-5 bg-slate-900 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
              <BarChart2 size={14} /> Project Health
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Tickets</p>
                <p className="text-2xl font-bold text-white">{totalTickets}</p>
                <p className="text-[10px] opacity-40 mt-0.5">{openTickets} open</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Resolved</p>
                <p className="text-2xl font-bold text-green-400">{resolvedTickets}</p>
                <p className="text-[10px] opacity-40 mt-0.5">{overallPct}% done</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Milestones</p>
                <p className="text-2xl font-bold text-white">{completedMs}<span className="text-base opacity-40">/{totalMs}</span></p>
                <p className="text-[10px] opacity-40 mt-0.5">completed</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Billed</p>
                <p className="text-2xl font-bold text-sanctum-gold">${totalBilled.toLocaleString()}</p>
                <p className="text-[10px] opacity-40 mt-0.5">of ${totalBillable.toLocaleString()}</p>
              </div>
            </div>
            {/* Overall progress bar */}
            <div className="mb-1 flex justify-between text-xs opacity-50">
              <span>Overall completion</span>
              <span>{overallPct}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-sanctum-gold transition-all duration-500"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>

          {/* MILESTONE LIST */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                <Flag size={16} /> Milestones
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 cursor-pointer hover:text-white transition-colors select-none">
                  <span>History {(!showCompletedMs && hiddenCount > 0) && <span className="text-slate-600">({hiddenCount})</span>}</span>
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showCompletedMs ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showCompletedMs ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input type="checkbox" className="hidden" checked={showCompletedMs} onChange={toggleShowCompleted} />
                </label>
                <button
                  onClick={() => { setEditingMsId(null); setMsForm({ name: '', description: '', billable_amount: '', due_date: '', sequence: project.milestones.length + 1 }); setShowMsModal(true); }}
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {visibleMilestones.length > 0 ? visibleMilestones.map((ms) => {
                const progress = getMilestoneProgress(ms);
                return (
                  <div key={ms.id} className="p-4 bg-black/20 rounded border border-white/5">
                    {/* MILESTONE HEADER */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {/* REORDER */}
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveMilestone(ms.id, -1)} className="text-slate-600 hover:text-white"><ChevronUp size={12} /></button>
                          <button onClick={() => moveMilestone(ms.id, 1)} className="text-slate-600 hover:text-white"><ChevronDown size={12} /></button>
                        </div>
                        {/* SEQUENCE BUBBLE */}
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-600 shrink-0">
                          {ms.sequence}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* MILESTONE NAME — link to MilestoneDetail */}
                            <Link
                              to={`/milestones/${ms.id}`}
                              className={`font-bold hover:text-sanctum-gold transition-colors ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {ms.name}
                            </Link>
                            <button onClick={() => { setEditingMsId(ms.id); setMsForm(ms); setShowMsModal(true); }} className="text-slate-500 hover:text-sanctum-gold shrink-0">
                              <Edit2 size={12} />
                            </button>
                          </div>
                          {ms.description && <p className="text-xs text-slate-400 italic mt-0.5">{ms.description}</p>}
                          <div className="flex items-center gap-3 mt-1 text-xs opacity-50">
                            <span>Due: {ms.due_date || 'TBD'}</span>
                            <span>•</span>
                            <span>${parseFloat(ms.billable_amount || 0).toLocaleString()}</span>
                            <span>•</span>
                            <span>{progress.done}/{progress.total} tasks</span>
                          </div>
                        </div>
                      </div>

                      {/* CONTROLS */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          className="bg-slate-800 border border-slate-600 text-xs rounded p-1 text-white uppercase font-bold"
                          value={ms.status}
                          onChange={(e) => updateMilestoneStatus(ms.id, e.target.value)}
                          disabled={!!ms.invoice_id}
                        >
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                        </select>
                        {!ms.invoice_id
                          ? <button onClick={() => generateInvoice(ms.id)} className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"><Receipt size={14} /> Bill</button>
                          : <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 border border-green-500/30 px-3 py-1 rounded bg-green-500/10"><Receipt size={14} /> Billed</span>
                        }
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    {progress.total > 0 && (
                      <div className="mb-3 px-1">
                        <div className="flex justify-between text-[10px] opacity-40 mb-1">
                          <span>{progress.done} of {progress.total} resolved</span>
                          <span>{progress.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${progress.pct === 100 ? 'bg-green-500' : 'bg-sanctum-gold/70'}`}
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* TICKETS */}
                    <div className="mt-3 pl-4 border-l-2 border-slate-800">
                      <TicketList
                        tickets={getTicketsForMilestone(ms.id)}
                        embedded={true}
                        onAdd={() => { setTicketForm({ ...ticketForm, milestone_id: ms.id }); setShowTicketModal(true); }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm opacity-30 italic text-center py-8">
                  {showCompletedMs ? "No milestones found." : "No active milestones. Toggle History to see completed milestones."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* MetadataStrip — first sidebar card, collapsed by default */}
          <MetadataStrip
            storageKey="ds_metadata_expanded_project"
            collapsed={<>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${projectStatusStyles[project.status] || 'bg-white/10 text-slate-300'}`}>
                {project.status}
              </span>
              <span className="opacity-40">·</span>
              <span className="opacity-50">
                {new Date(project.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </>}
            badges={[
              { label: project.status, className: projectStatusStyles[project.status] || 'bg-white/10 text-slate-300' },
            ]}
            dates={[
              { label: 'Started', value: project.start_date },
              { label: 'Due', value: project.due_date },
              { label: 'Created', value: project.created_at },
            ]}
            id={project.id}
          />

          <ProjectStats project={project} />
        </div>
      </div>

      {/* MILESTONE MODAL */}
      {showMsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm relative">
            <button onClick={() => setShowMsModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-lg font-bold mb-4">{editingMsId ? 'Edit Milestone' : 'Add Milestone'}</h2>
            <div className="space-y-3">
              <div><label className="text-xs opacity-50 block mb-1">Sequence</label><input type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.sequence} onChange={e => setMsForm({ ...msForm, sequence: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Name</label><input required placeholder="Name" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.name} onChange={e => setMsForm({ ...msForm, name: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Description</label><textarea placeholder="Optional notes..." className="w-full p-2 h-20 rounded bg-black/40 border border-slate-600 text-white text-sm font-mono" value={msForm.description || ''} onChange={e => setMsForm({ ...msForm, description: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Billable Value ($)</label><input type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.billable_amount} onChange={e => setMsForm({ ...msForm, billable_amount: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Target Date</label><input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={msForm.due_date || ''} onChange={e => setMsForm({ ...msForm, due_date: e.target.value })} /></div>
              <button onClick={handleSaveMilestone} className="w-full py-2 bg-sanctum-gold rounded text-sm text-slate-900 font-bold mt-2">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
            <button onClick={() => setShowTicketModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Clipboard size={20} className="text-sanctum-gold" /> Add Task</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs opacity-50 block mb-1">Type</label>
                  <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize" value={ticketForm.ticket_type} onChange={e => setTicketForm({ ...ticketForm, ticket_type: e.target.value })}>
                    {TICKET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-50 block mb-1">Priority</label>
                  <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize" value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                    {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="text-xs opacity-50 block mb-1">Subject</label><input autoFocus required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} /></div>
              <div>
                <label className="text-xs opacity-50 block mb-1">Description</label>
                <textarea
                  className="w-full p-2 h-24 rounded bg-black/40 border border-slate-600 text-white text-sm font-mono"
                  value={ticketForm.description || ''}
                  onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                  onKeyDown={(e) => handleSmartWrap(e, ticketForm.description, (v) => setTicketForm({ ...ticketForm, description: v }))}
                />
              </div>
              <button onClick={handleCreateTicket} className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Create Task</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
