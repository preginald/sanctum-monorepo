import React, { useMemo, useState } from 'react';
import { StatusBadge, PriorityBadge } from './TicketBadges';
import SanctumMarkdown from '../ui/SanctumMarkdown';
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_TYPES } from '../../lib/constants';
import { handleSmartWrap } from '../../lib/textUtils';
import SearchableSelect from '../ui/SearchableSelect';
import { User, Briefcase, X, Plus, ShieldCheck } from 'lucide-react';

export default function TicketOverview({ 
  ticket, isEditing, formData, setFormData, contacts, accountProjects, techs, 
  onLinkContact, onUnlinkContact, onUpdateTech, showQuickTech, setShowQuickTech 
}) {
  
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '';
  const formatInputDate = (d) => d ? d.slice(0, 16) : ''; 
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const [showInlineContact, setShowInlineContact] = useState(false);

  // --- DATA TRANSFORM ---
  const contactOptions = useMemo(() => {
      return (contacts || []).map(c => ({
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.email || c.persona || 'Contact'
      }));
  }, [contacts]);

  const handleAddContact = (contact) => {
      const current = formData.contact_ids || [];
      if (!current.includes(contact.id)) {
          setFormData({ ...formData, contact_ids: [...current, contact.id] });
      }
  };

  const handleRemoveContact = (id) => {
      const current = formData.contact_ids || [];
      setFormData({ ...formData, contact_ids: current.filter(cid => cid !== id) });
  };

if (!isEditing) {
  const assignedTech = techs?.find(u => u.id === ticket.assigned_tech_id);

  return (
    <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative space-y-6">
      {/* STATUS & PRIORITY ROW */}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-xs uppercase opacity-50 font-bold tracking-widest block mb-1">Status</label><StatusBadge status={ticket.status} /></div>
        <div><label className="text-xs uppercase opacity-50 font-bold tracking-widest block mb-1">Priority</label><PriorityBadge priority={ticket.priority} /></div>
      </div>
      
      {/* ASSIGNED TECHNICIAN SECTION */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <label className="text-xs uppercase opacity-50 font-bold tracking-widest flex items-center gap-2">
            <ShieldCheck size={14} className="text-purple-400" /> Assigned Agent
          </label>
          
          {!showQuickTech && (
            <button 
              onClick={() => setShowQuickTech(true)} 
              className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/5 border border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400 transition-all text-[10px] font-bold uppercase tracking-tighter"
            >
              <Plus size={12} className="group-hover:rotate-90 transition-transform" /> 
              Assign Agent
            </button>
          )}
        </div>

        {showQuickTech && (
          <div className="mb-4 animate-in slide-in-from-top-1 duration-200 z-20 relative">
            <SearchableSelect 
              items={techs || []}
              onSelect={(t) => { onUpdateTech(t.id); setShowQuickTech(false); }}
              placeholder="Select technician..."
              labelKey="full_name"
              icon={ShieldCheck}
              onClose={() => setShowQuickTech(false)}
            />
          </div>
        )}

        <div className="flex items-center gap-2 group max-w-fit">
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full shadow-sm">
            <ShieldCheck size={12} className={`text-purple-400 ${ticket.assigned_tech_id ? 'animate-pulse' : 'opacity-40'}`} />
            <span className="text-xs font-semibold text-purple-100">
              {assignedTech?.full_name || "Currently Unassigned"}
            </span>
          </div>
          
          {ticket.assigned_tech_id && (
            <button 
              onClick={() => onUpdateTech(null)}
              className="p-1.5 rounded-full bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
              title="Unassign Agent"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
        
        {/* STANDARDIZED CONTACT SECTION */}
<div className="pt-2 border-t border-slate-800">
  <div className="flex justify-between items-center mb-4">
    <label className="text-xs uppercase opacity-50 font-bold tracking-widest flex items-center gap-2">
      <User size={14} className="text-blue-400" /> Affected Humans
    </label>
    
    {!showInlineContact && (
      <button 
        onClick={() => setShowInlineContact(true)} 
        className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 transition-all text-[10px] font-bold uppercase tracking-tighter"
      >
        <Plus size={12} className="group-hover:rotate-90 transition-transform" /> 
        Link Contact
      </button>
    )}
  </div>

  {showInlineContact && (
    <div className="mb-4 animate-in slide-in-from-top-1 duration-200 z-20 relative">
      <SearchableSelect 
        items={contactOptions} 
        onSelect={(c) => { onLinkContact(c.id); setShowInlineContact(false); }} 
        placeholder="Find account contact..." 
        labelKey="title" 
        subLabelKey="subtitle" 
        icon={User} 
        onClose={() => setShowInlineContact(false)} 
      />
    </div>
  )}

  <div className="flex flex-wrap gap-2">
    {ticket.contacts?.length > 0 ? ticket.contacts.map(c => (
      <div key={c.id} className="group flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full transition-all hover:border-blue-400/50 shadow-sm">
        <User size={12} className="text-blue-400" />
        <span className="text-xs font-semibold text-blue-100">{c.first_name} {c.last_name}</span>
        <button 
            onClick={(e) => onUnlinkContact(e, c.id)} 
            className="ml-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
        >
            <X size={12} />
        </button>
      </div>
    )) : (
      <div className="py-2 px-1 text-xs opacity-30 italic flex items-center gap-2">
        <X size={12} /> No humans linked to this ticket.
      </div>
    )}
  </div>
</div>
        
        <div className="pt-2 border-t border-slate-800 text-sm text-gray-300 leading-relaxed">
            <SanctumMarkdown content={ticket.description || 'No description provided.'} />
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-[10px] font-mono uppercase tracking-tighter opacity-40">
            <div>Opened: {formatDate(ticket.created_at)}</div>
            <div>{ticket.closed_at ? `Closed: ${formatDate(ticket.closed_at)}` : `Last Update: ${formatDate(ticket.updated_at)}`}</div>
        </div>
        
        {ticket.resolution && (
            <div className="pt-4 border-t border-slate-800">
                <label className="text-xs uppercase opacity-50 block mb-2 text-green-400 font-bold">Official Resolution</label>
                <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl text-sm text-gray-300">
                    <SanctumMarkdown content={ticket.resolution} />
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- EDIT MODE (Unchanged structure, updated styling) ---
  return (
    <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl space-y-6 animate-in fade-in duration-200">
        <div className="grid grid-cols-4 gap-6">
            <div><label className="block text-xs uppercase opacity-50 mb-1">Status</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>{TICKET_STATUSES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}</select></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1">Priority</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>{TICKET_PRIORITIES.map(p => <option key={p} value={p}>{capitalize(p)}</option>)}</select></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1">Type</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.ticket_type} onChange={e => setFormData({...formData, ticket_type: e.target.value})}>{TICKET_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}</select></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-purple-400">Agent</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.assigned_tech_id || ""} onChange={e => setFormData({...formData, assigned_tech_id: e.target.value || null})}><option value="">-- Unassigned --</option>{techs?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Project / Milestone</label><SearchableSelect items={accountProjects.flatMap(p => p.milestones.map(m => ({ id: m.id, title: m.name, subtitle: p.name })))} selectedIds={formData.milestone_id ? [formData.milestone_id] : []} onSelect={(item) => setFormData({...formData, milestone_id: item.id})} placeholder="Search Project..." labelKey="title" subLabelKey="subtitle" icon={Briefcase} /></div>
            <div>
              <label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Contacts</label>
              <SearchableSelect items={contactOptions} selectedIds={formData.contact_ids || []} onSelect={handleAddContact} placeholder="Add Contact..." labelKey="title" subLabelKey="subtitle" icon={User} />
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.contact_ids?.map(id => (
                  <span key={id} className="flex items-center gap-1 bg-blue-500/10 text-blue-200 border border-blue-500/20 px-2 py-1 rounded-full text-[10px] font-bold">
                    {contactOptions.find(c => c.id === id)?.title}
                    <button onClick={() => handleRemoveContact(id)} className="ml-1 p-0.5 hover:text-red-400"><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Opened</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.created_at)} onChange={e => setFormData({...formData, created_at: e.target.value})} /></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Closed</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.closed_at)} onChange={e => setFormData({...formData, closed_at: e.target.value})} /></div>
        </div>
        <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white font-mono text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} onKeyDown={(e) => handleSmartWrap(e, formData.description, (v) => setFormData({...formData, description: v}))} />
        {formData.status === 'resolved' && <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} onKeyDown={(e) => handleSmartWrap(e, formData.resolution, (v) => setFormData({...formData, resolution: v}))} />}
    </div>
  );
}