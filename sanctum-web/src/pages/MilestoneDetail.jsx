import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { handleSmartWrap } from '../lib/textUtils';
import {
  Loader2, Plus, Receipt, Flag, X, Clipboard, Edit2,
  Hash, DollarSign, Calendar, FileText, Clock
} from 'lucide-react';
import api from '../lib/api';

import TicketList from '../components/tickets/TicketList';
import MetadataStrip from '../components/ui/MetadataStrip';
import ArtefactCard from '../components/ArtefactCard';

import { TICKET_TYPES, TICKET_PRIORITIES } from '../lib/constants';
import { milestoneStatusStyles } from '../lib/statusStyles';

export default function MilestoneDetail() {
  const { id } = useParams();
  const [milestone, setMilestone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // MODALS
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal', ticket_type: 'task' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  // STICKY NAV
  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;
    const handleScroll = () => setIsScrolled(scrollContainer.scrollTop > 60);
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { fetchMilestone(); }, [id]);

  const fetchMilestone = async () => {
    try {
      const res = await api.get(`/milestones/${id}`);
      setMilestone(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/milestones/${id}`, {
        name: editForm.name,
        description: editForm.description || null,
        billable_amount: parseFloat(editForm.billable_amount) || 0,
        sequence: parseInt(editForm.sequence) || 1,
        due_date: editForm.due_date || null,
      });
      setShowEditModal(false);
      fetchMilestone();
    } catch (e) { alert("Failed to save milestone"); }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tickets', {
        ...ticketForm,
        milestone_id: milestone.id,
        account_id: milestone.account_id,
      });
      setShowTicketModal(false);
      setTicketForm({ subject: '', description: '', priority: 'normal', ticket_type: 'task' });
      fetchMilestone();
    } catch (e) { alert("Failed to create ticket"); }
  };

  const generateInvoice = async () => {
    if (!confirm("Generate invoice for this milestone?")) return;
    try {
      await api.post(`/milestones/${id}/invoice`);
      fetchMilestone();
      alert("Invoice generated.");
    } catch (e) { alert("Error generating invoice"); }
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/milestones/${id}`, { status });
      fetchMilestone();
    } catch (e) { alert("Failed to update status"); }
  };

  if (loading || !milestone) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  const billable = parseFloat(milestone.billable_amount || 0);
  const totalTickets = milestone.tickets?.length || 0;
  const resolvedTickets = milestone.tickets?.filter(t => t.status === 'resolved').length || 0;
  const canBill = billable > 0 && !milestone.invoice_id;

  const totalHours = milestone.tickets?.reduce((s, t) => s + (t.total_hours || 0), 0) || 0;
  const totalInternalCost = milestone.tickets?.reduce((s, t) => s + parseFloat(t.total_cost || 0), 0) || 0;
  const totalUnpriced = milestone.tickets?.reduce((s, t) => s + (t.unpriced_entries || 0), 0) || 0;
  const hasDeliveryCost = totalHours > 0;

  const editButton = (
    <button
      onClick={() => { setEditForm({ name: milestone.name, description: milestone.description || '', billable_amount: milestone.billable_amount, due_date: milestone.due_date || '', sequence: milestone.sequence }); setShowEditModal(true); }}
      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded font-bold text-sm"
    >
      <Edit2 size={16} /> Edit
    </button>
  );

  const addTicketButton = (
    <button
      onClick={() => setShowTicketModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold text-sm"
    >
      <Plus size={16} /> Add Ticket
    </button>
  );

  const billButton = canBill ? (
    <button
      onClick={generateInvoice}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-sm"
    >
      <Receipt size={16} /> Bill Milestone
    </button>
  ) : null;

  return (
    <Layout
      title={milestone.name}
      breadcrumb={[
        { label: milestone.account_name, path: `/clients/${milestone.account_id}` },
        { label: milestone.project_name, path: `/projects/${milestone.project_id}` },
        { label: 'Milestones' },
      ]}
      onRefresh={fetchMilestone}
      onCopyMeta={() => `${milestone.name}\nProject: ${milestone.project_name}\nStatus: ${milestone.status}\nTickets: ${totalTickets}`}
      actions={<>{editButton}{addTicketButton}{billButton}</>}
    >

      {/* STICKY NAV */}
      <div className={`fixed top-16 left-0 right-0 z-20 transition-all duration-200 ${isScrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-2 flex items-center justify-between">
          <span className="text-sm font-bold truncate text-white">
            <span className="text-sanctum-gold mr-2">{milestone.project_name}</span>
            {milestone.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setEditForm({ name: milestone.name, description: milestone.description || '', billable_amount: milestone.billable_amount, due_date: milestone.due_date || '', sequence: milestone.sequence }); setShowEditModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded font-bold text-xs"
            >
              <Edit2 size={14} /> Edit
            </button>
            <button
              onClick={() => setShowTicketModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sanctum-gold text-slate-900 rounded font-bold text-xs"
            >
              <Plus size={14} /> Add Ticket
            </button>
            {canBill && (
              <button
                onClick={generateInvoice}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs"
              >
                <Receipt size={14} /> Bill
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* PRIMARY COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* TICKET LIST */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <TicketList
              tickets={milestone.tickets || []}
              title="Tickets"
              onAdd={() => setShowTicketModal(true)}
            />
          </div>

        </div>

        {/* SIDEBAR */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">

          {/* METADATA STRIP — first */}
          <MetadataStrip
            storageKey="ds_metadata_expanded_milestone"
            collapsed={<>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${milestoneStatusStyles[milestone.status] || 'bg-white/10 text-slate-300'}`}>
                {milestone.status}
              </span>
              <span className="opacity-40">·</span>
              <span className="opacity-50">
                {new Date(milestone.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </>}
            badges={[
              { label: milestone.status, className: milestoneStatusStyles[milestone.status] || 'bg-white/10 text-slate-300' },
            ]}
            dates={[
              { label: 'Created', value: milestone.created_at },
              { label: 'Due', value: milestone.due_date },
            ]}
            id={milestone.id}
          />

          {/* MILESTONE PROPERTIES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
              <Flag size={14} /> Properties
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Hash size={14} className="opacity-40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase opacity-50 font-bold mb-0.5">Sequence</p>
                  <p className="text-sm font-mono">#{milestone.sequence}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign size={14} className="opacity-40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase opacity-50 font-bold mb-0.5">Billable Amount</p>
                  <p className="text-sm">${billable.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Receipt size={14} className="opacity-40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase opacity-50 font-bold mb-0.5">Invoice</p>
                  {milestone.invoice_id
                    ? <Link to={`/invoices/${milestone.invoice_id}`} className="text-sm text-sanctum-gold hover:underline">View Invoice</Link>
                    : <p className="text-sm opacity-40">{billable > 0 ? 'Not yet billed' : 'No billable amount'}</p>
                  }
                </div>
              </div>
              {milestone.description && (
                <div className="flex items-start gap-3">
                  <FileText size={14} className="opacity-40 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase opacity-50 font-bold mb-0.5">Description</p>
                    <p className="text-sm text-slate-300 italic">{milestone.description}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Calendar size={14} className="opacity-40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase opacity-50 font-bold mb-0.5">Progress</p>
                  <p className="text-sm">{resolvedTickets}/{totalTickets} tickets resolved</p>
                  {totalTickets > 0 && (
                    <div className="mt-1.5 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${resolvedTickets === totalTickets ? 'bg-green-500' : 'bg-sanctum-gold/60'}`}
                        style={{ width: `${totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* STATUS CONTROL */}
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-2">Update Status</p>
                <select
                  className="w-full bg-slate-800 border border-slate-600 text-xs rounded p-2 text-white uppercase font-bold"
                  value={milestone.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={!!milestone.invoice_id}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* DELIVERY COST */}
          {hasDeliveryCost && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
                <Clock size={14} /> Delivery Cost
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="opacity-50">Total Hours</span>
                  <span className="font-mono font-bold text-white text-lg">{totalHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="opacity-50">Internal Cost</span>
                  <span className="font-mono font-bold text-white text-lg">${totalInternalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                {totalUnpriced > 0 && (
                  <div className="text-[10px] text-orange-400/60">
                    {totalUnpriced} {totalUnpriced === 1 ? 'entry' : 'entries'} unpriced
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ARTEFACTS */}
          <ArtefactCard
            entityType="milestone"
            entityId={milestone.id}
            artefacts={milestone.artefacts || []}
            onUpdate={fetchMilestone}
          />

          {/* PARENT PROJECT */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Project</h3>
            <Link
              to={`/projects/${milestone.project_id}`}
              className="text-sanctum-gold hover:underline font-semibold text-sm"
            >
              {milestone.project_name}
            </Link>
          </div>

        </div>
      </div>

      {/* EDIT MILESTONE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm relative">
            <button onClick={() => setShowEditModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit2 size={18} className="text-sanctum-gold" /> Edit Milestone</h2>
            <div className="space-y-3">
              <div><label className="text-xs opacity-50 block mb-1">Sequence</label><input type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={editForm.sequence} onChange={e => setEditForm({ ...editForm, sequence: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Name</label><input required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Description</label><textarea placeholder="Optional notes..." className="w-full p-2 h-20 rounded bg-black/40 border border-slate-600 text-white text-sm font-mono" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Billable Value ($)</label><input type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={editForm.billable_amount} onChange={e => setEditForm({ ...editForm, billable_amount: e.target.value })} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Target Date</label><input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={editForm.due_date || ''} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} /></div>
              <button onClick={handleSaveMilestone} className="w-full py-2 bg-sanctum-gold rounded text-sm text-slate-900 font-bold mt-2">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
            <button onClick={() => setShowTicketModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
              <Clipboard size={20} className="text-sanctum-gold" /> Add Ticket
            </h2>
            <p className="text-xs opacity-40 mb-4">{milestone.name}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs opacity-50 block mb-1">Type</label>
                  <select
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize"
                    value={ticketForm.ticket_type}
                    onChange={e => setTicketForm({ ...ticketForm, ticket_type: e.target.value })}
                  >
                    {TICKET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-50 block mb-1">Priority</label>
                  <select
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm capitalize"
                    value={ticketForm.priority}
                    onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  >
                    {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">Subject</label>
                <input
                  autoFocus
                  required
                  className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm"
                  value={ticketForm.subject}
                  onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs opacity-50 block mb-1">Description</label>
                <textarea
                  className="w-full p-2 h-24 rounded bg-black/40 border border-slate-600 text-white text-sm font-mono"
                  value={ticketForm.description}
                  onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                  onKeyDown={(e) => handleSmartWrap(e, ticketForm.description, (v) => setTicketForm({ ...ticketForm, description: v }))}
                />
              </div>
              <button
                onClick={handleCreateTicket}
                className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
