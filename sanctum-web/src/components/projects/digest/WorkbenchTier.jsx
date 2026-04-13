import React from 'react';
import { X, Wrench } from 'lucide-react';
import StatusBadge from '../../ui/StatusBadge';

function TicketProgress({ summary }) {
  if (!summary) return null;
  const { total, resolved } = summary;
  if (!total) return null;
  const pct = Math.round((resolved / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-slate-700 h-1 rounded-full overflow-hidden">
        <div className="bg-indigo-500 h-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 whitespace-nowrap">{resolved}/{total}</span>
    </div>
  );
}

function WorkbenchCard({ pin, onUnpin, onNavigate }) {
  return (
    <div
      onClick={() => onNavigate(pin.project_id)}
      className="bg-slate-800 border border-slate-700 border-l-4 border-l-sanctum-gold/60 p-3 rounded-r h-[110px] flex flex-col justify-between hover:border-slate-600 cursor-pointer transition-all relative group"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onUnpin(pin.project_id); }}
        className="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Unpin"
      >
        <X size={14} />
      </button>
      <div>
        <h4 className="font-bold text-slate-50 text-sm pr-5 truncate">{pin.project_name}</h4>
        <div className="flex items-center gap-2 mt-1">
          <StatusBadge value={pin.status} map="projectStatus" />
          <span className="text-[10px] text-slate-500 truncate">{pin.account_name}</span>
        </div>
      </div>
      <TicketProgress summary={pin.ticket_summary} />
    </div>
  );
}

export default function WorkbenchTier({ pins, maxPins, onUnpin, onNavigate }) {
  return (
    <section className="border-l-4 border-sanctum-gold/50 bg-slate-800/30 p-4 rounded-r-lg">
      <div className="flex items-center gap-2 mb-3">
        <Wrench size={16} className="text-sanctum-gold" />
        <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-sanctum-gold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Workbench
        </h3>
        <span className="text-[10px] text-slate-500 ml-1">{pins.length}/{maxPins}</span>
      </div>
      {pins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {pins.map(pin => (
            <WorkbenchCard key={pin.project_id} pin={pin} onUnpin={onUnpin} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 py-2">Pin projects you're working on</p>
      )}
    </section>
  );
}
