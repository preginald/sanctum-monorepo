import React from 'react';
import { StatusBadge, PriorityBadge } from './TicketBadges';
import SanctumMarkdown from '../ui/SanctumMarkdown';

export default function TicketOverview({ ticket, isEditing, formData, setFormData, contacts, accountProjects }) {
  
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '';
  const formatInputDate = (d) => d ? d.slice(0, 16) : ''; // Quick fix for datetime-local input

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

  return (
    <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl space-y-6 animate-in fade-in duration-200">
        <div className="grid grid-cols-3 gap-6">
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Status</label>
                <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option>
                </select>
            </div>
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Priority</label>
                <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
            </div>
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1">Type</label>
                <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.ticket_type} onChange={e => setFormData({...formData, ticket_type: e.target.value})}>
                    <option value="support">Support</option><option value="bug">Bug</option><option value="feature">Feature</option><option value="task">Task</option>
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Project / Milestone</label>
                <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.milestone_id || ""} onChange={e => setFormData({...formData, milestone_id: e.target.value || null})}>
                    <option value="">(No Link)</option>
                    {accountProjects.map(p => (<optgroup key={p.id} label={p.name}>{p.milestones.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</optgroup>))}
                </select>
            </div>
            <div>
                <label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Primary Contact</label>
                <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.contact_id || ""} onChange={e => setFormData({...formData, contact_id: e.target.value || null})}>
                    <option value="">-- None --</option>
                    {contacts.map(c => (<option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>))}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Opened</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.created_at)} onChange={e => setFormData({...formData, created_at: e.target.value})} /></div>
            <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Closed</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formatInputDate(formData.closed_at)} onChange={e => setFormData({...formData, closed_at: e.target.value})} /></div>
        </div>
        
        <div>
            <label className="block text-xs uppercase opacity-50 mb-1">Description</label>
            <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white font-mono text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        
        <div className={formData.status === 'resolved' ? 'opacity-100' : 'opacity-50 grayscale transition-all'}>
            <label className="block text-xs uppercase opacity-50 mb-1">Resolution</label>
            <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} disabled={formData.status !== 'resolved'} />
        </div>
    </div>
  );
}