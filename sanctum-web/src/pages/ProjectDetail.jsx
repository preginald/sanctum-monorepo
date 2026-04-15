import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  Loader2, Plus, Receipt, Flag,
  X, Edit2, ChevronUp, ChevronDown,
  BarChart2, Calendar
} from 'lucide-react';
import api from '../lib/api';

import ProjectStats from '../components/projects/ProjectStats';
import MetadataStrip from '../components/ui/MetadataStrip';
import ArtefactCard from '../components/ArtefactCard';

import { projectStatusStyles } from '../lib/statusStyles';

export default function ProjectDetail() {
  const { id } = useParams();
  const formatDate = (val) => val ? new Date(val).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
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
  const [editingMsId, setEditingMsId] = useState(null);
  const [msForm, setMsForm] = useState({ name: '', description: '', billable_amount: '', due_date: '', sequence: 1 });

  // STICKY NAV
  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;
    const handleScroll = () => setIsScrolled(scrollContainer.scrollTop > 60);
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchProject = async () => {
    try {
      const pRes = await api.get(`/projects/${id}`);
      if (pRes.data.milestones) pRes.data.milestones.sort((a, b) => a.sequence - b.sequence);
      setProject(pRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchRef = useRef(fetchProject);
  fetchRef.current = fetchProject;

  useEffect(() => { fetchProject(); }, [id]);

  useEffect(() => {
    const pid = setInterval(() => fetchRef.current(), 30000);
    return () => clearInterval(pid);
  }, [id]);

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
  const getMilestoneProgress = (ms) => {
    const tickets = ms.tickets || [];
    if (tickets.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = tickets.filter(t => t.status === 'resolved').length;
    return { done, total: tickets.length, pct: Math.round((done / tickets.length) * 100) };
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
  const totalHours = allTickets.reduce((sum, t) => sum + (t.total_hours || 0), 0);
  const totalInternalCost = allTickets.reduce((sum, t) => sum + parseFloat(t.total_cost || 0), 0);
  const totalUnpriced = allTickets.reduce((sum, t) => sum + (t.unpriced_entries || 0), 0);

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
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
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

            <div className="space-y-2">
              {visibleMilestones.length > 0 ? visibleMilestones.map((ms) => {
                const progress = getMilestoneProgress(ms);
                return (
                  <div key={ms.id} className="flex items-center gap-3 px-3 py-2.5 bg-black/20 rounded border border-white/5 hover:border-white/10 group transition-colors">

                    {/* REORDER */}
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => moveMilestone(ms.id, -1)} className="text-slate-600 hover:text-white"><ChevronUp size={11} /></button>
                      <button onClick={() => moveMilestone(ms.id, 1)} className="text-slate-600 hover:text-white"><ChevronDown size={11} /></button>
                    </div>

                    {/* SEQUENCE */}
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-[10px] border border-slate-600 shrink-0">
                      {ms.sequence}
                    </div>

                    {/* NAME + DESCRIPTION */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/milestones/${ms.id}`}
                          className={`font-semibold text-sm hover:text-sanctum-gold transition-colors truncate ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}
                        >
                          {ms.name}
                        </Link>
                        <button
                          onClick={() => { setEditingMsId(ms.id); setMsForm(ms); setShowMsModal(true); }}
                          className="text-slate-600 hover:text-sanctum-gold opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                      {ms.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{ms.description}</p>
                      )}
                      {/* PROGRESS BAR */}
                      {progress.total > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progress.pct === 100 ? 'bg-green-500' : 'bg-sanctum-gold/60'}`}
                              style={{ width: `${progress.pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] opacity-40 shrink-0">{progress.done}/{progress.total}</span>
                        </div>
                      )}
                    </div>

                    {/* DUE DATE */}
                    {ms.due_date && (
                      <span className="flex items-center gap-1 text-[10px] font-mono opacity-40 shrink-0 whitespace-nowrap">
                        <Calendar size={10} />
                        {new Date(ms.due_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                      </span>
                    )}

                    {/* COST SUMMARY */}
                    {(() => {
                      const msHours = (ms.tickets || []).reduce((s, t) => s + (t.total_hours || 0), 0);
                      const msCost = (ms.tickets || []).reduce((s, t) => s + parseFloat(t.total_cost || 0), 0);
                      return msHours > 0 ? (
                        <span className="text-[10px] font-mono opacity-40 shrink-0 whitespace-nowrap">
                          {msHours.toFixed(1)}h · ${msCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : null;
                    })()}

                    {/* STATUS + BILLING */}
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        className="bg-slate-800 border border-slate-600 text-[10px] rounded p-1 text-white uppercase font-bold"
                        value={ms.status}
                        onChange={(e) => updateMilestoneStatus(ms.id, e.target.value)}
                        disabled={!!ms.invoice_id}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                      {parseFloat(ms.billable_amount || 0) > 0 && (
                        !ms.invoice_id
                          ? <button onClick={() => generateInvoice(ms.id)} className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"><Receipt size={12} /> Bill</button>
                          : <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 border border-green-500/30 px-2 py-1 rounded bg-green-500/10"><Receipt size={12} /> Billed</span>
                      )}
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
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto scrollbar-thin">
          {/* MetadataStrip — first sidebar card, collapsed by default */}
          <MetadataStrip
            storageKey="ds_metadata_expanded_project"
            collapsed={<>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${projectStatusStyles[project.status] || 'bg-white/10 text-slate-300'}`}>
                {project.status}
              </span>
              <span className="opacity-40">·</span>
              <span className="opacity-50">
                {formatDate(project.created_at)}
              </span>
              {project.start_date && <>
                <span className="opacity-40">·</span>
                <span className="opacity-50">Started {formatDate(project.start_date)}</span>
              </>}
              {project.due_date && <>
                <span className="opacity-40">·</span>
                <span className="opacity-50 text-amber-400">Due {formatDate(project.due_date)}</span>
              </>}
            </>}
            badges={[
              { label: project.status, className: projectStatusStyles[project.status] || 'bg-white/10 text-slate-300' },
              ...(project.template_name ? [{ label: `TPL: ${project.template_name}`, className: 'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border bg-white/10 text-slate-300 border-white/20' }] : []),
            ]}
            dates={[
              { label: 'Started', value: project.start_date },
              { label: 'Due', value: project.due_date },
              { label: 'Created', value: project.created_at },
            ]}
            id={project.id}
          />

          <ProjectStats project={project} />

          {/* ARTEFACTS */}
          <ArtefactCard
            entityType="project"
            entityId={project.id}
            artefacts={project.artefacts || []}
            onUpdate={fetchProject}
          />
        </div>
      </div>

      {/* MILESTONE MODAL */}
      {showMsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm relative">
            <button onClick={() => setShowMsModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">{editingMsId ? <><Edit2 size={18} className="text-sanctum-gold" /> Edit Milestone</> : <><Plus size={18} className="text-sanctum-gold" /> Add Milestone</>}</h2>
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


    </Layout>
  );
}
