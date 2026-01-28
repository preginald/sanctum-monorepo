import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, User, Briefcase, Building } from 'lucide-react'; // Added Building
import api from '../../lib/api';
import { TICKET_TYPES, TICKET_PRIORITIES } from '../../lib/constants';
import { handleSmartWrap } from '../../lib/textUtils';
import SearchableSelect from '../ui/SearchableSelect';

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
      } else {
          // Reset context if account cleared
          setActiveContacts([]);
          setActiveProjects([]);
      }
  }, [form.account_id]);

  // --- DATA TRANSFORMATION ---
  const milestoneOptions = useMemo(() => {
      return activeProjects.flatMap(p => 
          p.milestones.map(m => ({
              id: m.id,
              title: m.name,
              subtitle: p.name 
          }))
      );
  }, [activeProjects]);

  const contactOptions = useMemo(() => {
      return activeContacts.map(c => ({
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.email || c.persona || 'Contact'
      }));
  }, [activeContacts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: Client is mandatory
    if (!form.account_id) {
        alert("Please select a client.");
        return;
    }

    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.milestone_id) delete payload.milestone_id;
      
      const res = await api.post('/tickets', payload);
      if (onSuccess) onSuccess(res.data);
      
      onClose();
      
      // Reset Form
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
      alert("Failed to create ticket: " + (e.response?.data?.detail || "Unknown Error"));
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
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
        <h2 className="text-xl font-bold mb-4 text-white">Create Ticket</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* CLIENT SELECTOR (Refactored) */}
          {!preselectedAccountId ? (
            <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                <label className="text-xs text-blue-400 block mb-2 uppercase font-bold tracking-wider">Client Context</label>
                <SearchableSelect
                    items={clients}
                    selectedIds={form.account_id ? [form.account_id] : []}
                    onSelect={(item) => setForm({...form, account_id: item.id})}
                    placeholder="Search Clients..."
                    labelKey="name"
                    subLabelKey="type" // Shows 'client' or 'prospect'
                    icon={Building}
                />
                {form.account_id && (
                    <div className="mt-2 text-right">
                        <button type="button" onClick={() => setForm({...form, account_id: ''})} className="text-[10px] text-red-400 hover:underline">
                            Change Client
                        </button>
                    </div>
                )}
            </div>
          ) : (
             <div className="text-xs text-sanctum-gold mb-2 uppercase font-bold tracking-wider">
                 Client: {clients.find(c => c.id === preselectedAccountId)?.name || 'Linked Account'}
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Type</label>
                <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.ticket_type} onChange={e => setForm({...form, ticket_type: e.target.value})}>
                    {TICKET_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Priority</label>
                <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{capitalize(p)}</option>)}
                </select>
              </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Subject</label>
            <input required autoFocus className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Printer Offline" />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Description</label>
            <textarea 
                className="w-full p-2 h-24 rounded bg-black/20 border border-slate-700 text-white text-sm" 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                onKeyDown={(e) => handleSmartWrap(e, form.description, (v) => setForm({...form, description: v}))}
            />
          </div>

          {/* DYNAMIC CONTEXT (Contacts & Milestones) */}
          {/* Only show this if account is selected */}
          {form.account_id && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800 rounded border border-slate-700 animate-in fade-in slide-in-from-top-2">
                  <div className="flex flex-col h-full">
                    <label className="text-xs text-blue-400 block mb-1">Contacts</label>
                    <div className="flex flex-wrap gap-1 mb-2 min-h-[20px]">
                        {form.contact_ids.map(id => {
                            const c = activeContacts.find(x => x.id === id);
                            return c ? <span key={id} className="text-[10px] bg-slate-600 px-1 rounded flex items-center">{c.first_name}<button type="button" onClick={() => toggleContact(id)} className="ml-1 hover:text-red-400"><X size={10}/></button></span> : null;
                        })}
                    </div>
                    <div className="flex-1">
                        <SearchableSelect 
                            items={contactOptions.filter(c => !form.contact_ids.includes(c.id))}
                            onSelect={(item) => toggleContact(item.id)}
                            placeholder="+ Add Person..."
                            labelKey="title"
                            subLabelKey="subtitle"
                            icon={User}
                        />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-blue-400 block mb-1">Link to Milestone</label>
                    <SearchableSelect 
                        items={milestoneOptions}
                        selectedIds={form.milestone_id ? [form.milestone_id] : []}
                        onSelect={(item) => setForm({...form, milestone_id: item.id})}
                        placeholder="Search Project..."
                        labelKey="title"
                        subLabelKey="subtitle"
                        icon={Briefcase}
                    />
                    {form.milestone_id && (
                        <button type="button" onClick={() => setForm({...form, milestone_id: ''})} className="text-[10px] text-red-400 mt-1 hover:underline">
                            Clear Selection
                        </button>
                    )}
                  </div>
              </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-700 rounded text-white">Cancel</button>
            <button 
                type="submit" 
                disabled={loading || !form.account_id} // Disable if no client
                className="flex-1 py-2 rounded text-white font-bold bg-sanctum-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}