import React, { useMemo } from 'react';
import { StatusBadge, PriorityBadge } from './TicketBadges';
import SanctumMarkdown from '../ui/SanctumMarkdown';
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_TYPES } from '../../lib/constants';
import { handleSmartWrap } from '../../lib/textUtils';
import SearchableSelect from '../ui/SearchableSelect'; // NEW IMPORT
import { User, Briefcase } from 'lucide-react';

export default function TicketOverview({ ticket, isEditing, formData, setFormData, contacts, accountProjects }) {
  
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '';
  const formatInputDate = (d) => d ? d.slice(0, 16) : ''; 
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // --- DATA TRANSFORM ---
  const milestoneOptions = useMemo(() => {
      return (accountProjects || []).flatMap(p => 
          p.milestones.map(m => ({
              id: m.id,
              title: m.name,
              subtitle: p.name 
          }))
      );
  }, [accountProjects]);

  const contactOptions = useMemo(() => {
      return (contacts || []).map(c => ({
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.email || c.persona || 'Contact'
      }));
  }, [contacts]);

  if (!isEditing) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs uppercase opacity-50 block mb-1">Status</label><StatusBadge status={ticket.status} /></div>
          <div><label className="text-xs uppercase opacity-50 block mb-1">Priority</label><PriorityBadge priority={ticket.priority} /></div>
        </div>
        
        <div className="pt-2 border-t border-slate-800">
          <label className="text-xs uppercase opacity-50 block mb-2">Affected Humans</label>
          <div className="flex flex-wrap gap-2">
            {ticket.contacts?.length > 0 ? ticket.contacts.map(c => (
              <span key={c.id} className="bg-white/10 px-2 py-1 rounded text-xs flex items-center gap-1">{c.first_name} {c.last_name}</span>
            )) : <span className="text-xs opacity-30 italic">No contacts linked.</span>}
          </div>
        </div>
        
        <div className="pt-2 border-t border-slate-800">
            <div className="text-sm text-gray-300">
                <SanctumMarkdown content={ticket.description || 'No description provided.'} />
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs font-mono opacity-50">
            <div>Opened: {formatDate(ticket.created_at)}</div>
            <div>{ticket.closed_at ? `Closed: ${formatDate(ticket.closed_at)}` : `Last Update: ${formatDate(ticket.updated_at)}`}</div>
        </div>
        
        {ticket.resolution && (
            <div className="pt-4 border-t border-slate-800">
                <label className="text-xs uppercase opacity-50 block mb-2 text-green-400">Resolution</label>
                <div className="p-3 bg-green-900/10 border border-green-900/30 rounded text-sm text-gray-300">
                    <SanctumMarkdown content={ticket.resolution} />
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- EDIT MODE ---
  return (
    <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl space-y-6 animate-in fade-in duration-200">
        <div className="grid grid-cols-3 gap-6">
            
            {/* STATUS */}
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Status</label>
                <select 
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})}
                >
                    {TICKET_STATUSES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
                </select>
            </div>

            {/* PRIORITY */}
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Priority</label>
                <select 
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value})}
                >
                    {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{capitalize(p)}</option>)}
                </select>
            </div>

            {/* TYPE */}
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Type</label>
                <select 
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" 
                    value={formData.ticket_type} 
                    onChange={e => setFormData({...formData, ticket_type: e.target.value})}
                >
                    {TICKET_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
                </select>
            </div>
        </div>

        {/* SEARCHABLE SELECTS */}
        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Project / Milestone</label>
                <SearchableSelect 
                    items={milestoneOptions}
                    selectedIds={formData.milestone_id ? [formData.milestone_id] : []}
                    onSelect={(item) => setFormData({...formData, milestone_id: item.id})}
                    placeholder="Search Project..."
                    labelKey="title"
                    subLabelKey="subtitle"
                    icon={Briefcase}
                />
                {formData.milestone_id && (
                    <button onClick={() => setFormData({...formData, milestone_id: null})} className="text-[10px] text-red-400 mt-1 hover:underline">
                        Clear Selection
                    </button>
                )}
            </div>
            
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Primary Contact</label>
                <SearchableSelect 
                    items={contactOptions}
                    selectedIds={formData.contact_id ? [formData.contact_id] : []}
                    onSelect={(item) => setFormData({...formData, contact_id: item.id})}
                    placeholder="Search Contact..."
                    labelKey="title"
                    subLabelKey="subtitle"
                    icon={User}
                />
                {formData.contact_id && (
                    <button onClick={() => setFormData({...formData, contact_id: null})} className="text-[10px] text-red-400 mt-1 hover:underline">
                        Clear Selection
                    </button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Opened</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.created_at)} onChange={e => setFormData({...formData, created_at: e.target.value})} /></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Closed</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.closed_at)} onChange={e => setFormData({...formData, closed_at: e.target.value})} /></div>
        </div>
        
        <div>
            <label className="block text-xs uppercase opacity-50 mb-1">Description</label>
            <textarea 
                className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white font-mono text-sm" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                onKeyDown={(e) => handleSmartWrap(e, formData.description, (v) => setFormData({...formData, description: v}))}
            />
        </div>
        
        <div className={formData.status === 'resolved' ? 'opacity-100' : 'opacity-50 grayscale transition-all'}>
            <label className="block text-xs uppercase opacity-50 mb-1">Resolution</label>
            <textarea 
                className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" 
                value={formData.resolution} 
                onChange={e => setFormData({...formData, resolution: e.target.value})} 
                disabled={formData.status !== 'resolved'} 
                onKeyDown={(e) => handleSmartWrap(e, formData.resolution, (v) => setFormData({...formData, resolution: v}))}
            />
        </div>
    </div>
  );
}