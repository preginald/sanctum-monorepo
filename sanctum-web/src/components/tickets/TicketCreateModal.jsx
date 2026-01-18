import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import api from '../../lib/api';
// NEW: Import Constants
import { TICKET_TYPES, TICKET_PRIORITIES } from '../../lib/constants';

export default function TicketCreateModal({ isOpen, onClose, onSuccess, preselectedAccountId }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  
  // Context Data
  const [activeContacts, setActiveContacts] = useState([]);
  const [activeProjects, setActiveProjects] = useState([]);

  const [form, setForm] = useState({ 
      account_id: preselectedAccountId || '', 
      contact_ids: [], 
      milestone_id: '',
      subject: '', 
      description: '',
      priority: 'normal', 
      ticket_type: 'support' 
  });

  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Load Clients (if needed)
  useEffect(() => {
    if (isOpen && !preselectedAccountId) {
      api.get('/accounts').then(res => setClients(res.data));
    }
    if (isOpen && preselectedAccountId) {
        setForm(prev => ({ ...prev, account_id: preselectedAccountId }));
    }
  }, [isOpen, preselectedAccountId]);

  // Load Context when Account Changes
  useEffect(() => {
      if (form.account_id) {
          api.get(`/accounts/${form.account_id}`).then(res => {
              setActiveContacts(res.data.contacts || []);
              setActiveProjects(res.data.projects || []);
          });
      }
  }, [form.account_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.milestone_id) delete payload.milestone_id;
      
      await api.post('/tickets', payload);
      onSuccess();
      onClose();
      // Reset form (keep account if preselected)
      setForm({ 
          account_id: preselectedAccountId || '', 
          contact_ids: [], 
          milestone_id: '', 
          subject: '', 
          description: '', 
          priority: 'normal', 
          ticket_type: 'support' 
      });
    } catch (e) {
      alert("Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (id) => {
      const current = form.contact_ids;
      setForm({ ...form, contact_ids: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
        <h2 className="text-xl font-bold mb-4 text-white">Create Ticket</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* CLIENT SELECTOR (Only if not preselected) */}
          {!preselectedAccountId && (
            <div>
                <label className="text-xs text-slate-400 block mb-1">Client</label>
                <select required className="w-full p-2 rounded bg-black/40 border border-slate-700 text-white" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                <option value="">Select...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                {/* UPDATED: Dynamic Options */}
                <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.ticket_type} onChange={e => setForm({...form, ticket_type: e.target.value})}>
                    {TICKET_TYPES.map(t => (
                        <option key={t} value={t}>{capitalize(t)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Priority</label>
                {/* UPDATED: Dynamic Options */}
                <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    {TICKET_PRIORITIES.map(p => (
                        <option key={p} value={p}>{capitalize(p)}</option>
                    ))}
                </select>
              </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Subject</label>
            <input required autoFocus className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Printer Offline" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Description</label>
            <textarea className="w-full p-2 h-24 rounded bg-black/20 border border-slate-700 text-white text-sm" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          {/* DYNAMIC CONTEXT */}
          {form.account_id && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800 rounded border border-slate-700">
                  {/* CONTACTS */}
                  <div>
                    <label className="text-xs text-blue-400 block mb-1">Contacts</label>
                    <div className="flex flex-wrap gap-1 mb-1">
                        {form.contact_ids.map(id => {
                            const c = activeContacts.find(x => x.id === id);
                            return c ? <span key={id} className="text-[10px] bg-slate-600 px-1 rounded flex items-center">{c.first_name}<button type="button" onClick={() => toggleContact(id)} className="ml-1"><X size={10}/></button></span> : null;
                        })}
                    </div>
                    <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" onChange={e => { if(e.target.value) toggleContact(e.target.value); }} value="">
                        <option value="">+ Add Person</option>
                        {activeContacts.filter(c => !form.contact_ids.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                  </div>

                  {/* PROJECTS */}
                  <div>
                    <label className="text-xs text-blue-400 block mb-1">Link to Milestone</label>
                    <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={form.milestone_id} onChange={e => setForm({...form, milestone_id: e.target.value})}>
                        <option value="">-- None --</option>
                        {activeProjects.map(p => (
                            <optgroup key={p.id} label={p.name}>
                                {p.milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                  </div>
              </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-700 rounded text-white">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 rounded text-white font-bold bg-sanctum-blue hover:bg-blue-600">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}