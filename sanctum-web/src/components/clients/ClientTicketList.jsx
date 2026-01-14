import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { Plus, CheckCircle, Clock, Trash2, Bug, Zap, Clipboard, AlertCircle, LifeBuoy } from 'lucide-react';

export default function ClientTicketList({ tickets, onAdd, onDelete }) {
  const navigate = useNavigate();
  const [showClosed, setShowClosed] = useState(false);

  const visibleTickets = tickets.filter(t => showClosed ? true : t.status !== 'resolved');

  const getTypeIcon = (type) => {
      switch(type) {
          case 'bug': return <Bug size={14} className="text-red-400" />;
          case 'feature': return <Zap size={14} className="text-yellow-400" />;
          case 'task': return <Clipboard size={14} className="text-blue-400" />;
          default: return <LifeBuoy size={14} className="text-slate-400" />;
      }
  };

  return (
      <Card 
        title="Tickets" 
        action={
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-400">
                    <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="accent-pink-500 rounded"/>
                    <span>Show History</span>
                </label>
                <Button variant="ghost" size="sm" icon={Plus} onClick={onAdd} />
            </div>
        }
      >
         <div className="space-y-2">
            {visibleTickets.length === 0 && <p className="opacity-50 text-sm italic">No active tickets.</p>}
            {visibleTickets.map(t => (
              <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-pink-500/50 transition-colors group">
                <div>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(t.ticket_type)}
                    <Badge variant={t.priority === 'critical' ? 'danger' : 'default'}>{t.priority}</Badge>
                    <span className="font-medium text-sm text-white">{t.subject}</span>
                  </div>
                  <span className="text-[10px] opacity-40 font-mono">#{t.id} • {t.status}</span>
                </div>
                <div className="flex items-center gap-3">
                    {t.status === 'resolved' ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
                    <button onClick={(e) => {e.stopPropagation(); onDelete(t.id);}} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
         </div>
      </Card>
  );
}