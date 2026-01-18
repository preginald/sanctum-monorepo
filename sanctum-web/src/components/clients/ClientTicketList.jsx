import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Ticket, Clock, CheckCircle } from 'lucide-react';
import { TicketTypeIcon } from '../tickets/TicketBadges'; 

export default function ClientTicketList({ tickets, onAdd, onDelete }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  // Filter logic: If showAll is false, hide resolved. Always sort by ID desc (newest first).
  const visibleTickets = tickets
    .filter(t => showAll ? true : t.status !== 'resolved')
    .sort((a, b) => b.id - a.id)
    .slice(0, showAll ? 50 : 5); // Limit display if not showing history

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
          <Ticket size={16} /> Recent Tickets
        </h3>
        
        <div className="flex items-center gap-3">
            {/* HISTORY TOGGLE */}
            <label className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 cursor-pointer hover:text-white transition-colors">
                <span>History</span>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showAll ? 'bg-blue-600' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showAll ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            </label>

            {/* ADD BUTTON */}
            <button 
              onClick={onAdd} 
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
              title="New Ticket"
            >
              <Plus size={16} />
            </button>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {visibleTickets.length > 0 ? visibleTickets.map(t => (
          <div 
            key={t.id} 
            onClick={() => navigate(`/tickets/${t.id}`)} 
            className="flex justify-between p-3 bg-black/20 rounded border border-white/5 hover:border-white/20 cursor-pointer group relative pr-10 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TicketTypeIcon type={t.ticket_type} />
                <span className="font-bold text-white text-sm">{t.subject}</span>
              </div>
              <span className="text-xs opacity-50 block pl-6">
                 #{t.id} • {new Date(t.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <div className="flex flex-col items-end gap-1">
                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${t.status === 'resolved' ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'}`}>
                    {t.status}
                </div>
            </div>
            
            {/* DELETE BUTTON */}
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              title="Archive Ticket"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )) : (
          <p className="text-sm opacity-30 italic p-2">No active tickets found.</p>
        )}
      </div>
    </div>
  );
}