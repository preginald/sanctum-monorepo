import React from 'react';
import { Flag, ChevronUp, ChevronDown, Edit2, Receipt, Plus, CheckCircle, Circle, Bug, Zap, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MilestoneList({ milestones, onMove, onEdit, onStatusChange, onInvoice, onAddTask }) {
  const navigate = useNavigate();

  const getIconForType = (type) => {
      if(type==='bug') return <Bug size={14} className="text-red-400"/>; 
      if(type==='feature') return <Zap size={14} className="text-yellow-400"/>; 
      return <Activity size={14} className="text-blue-400"/>; 
  };

  return (
      <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-6 flex items-center gap-2"><Flag size={16} /> Milestones & Billing</h3>
          <div className="space-y-4">
              {milestones?.map((ms, index) => (
                  <div key={ms.id} className="p-4 bg-black/20 rounded border border-white/5">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                              <div className="flex flex-col gap-0.5 mr-2">
                                  <button onClick={() => onMove(index, -1)} className="text-slate-600 hover:text-white"><ChevronUp size={12}/></button>
                                  <button onClick={() => onMove(index, 1)} className="text-slate-600 hover:text-white"><ChevronDown size={12}/></button>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-600">{ms.sequence}</div>
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h4 className={`font-bold ${ms.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{ms.name}</h4>
                                      <button onClick={() => onEdit(ms)} className="text-slate-500 hover:text-sanctum-gold"><Edit2 size={12}/></button>
                                  </div>
                                  <p className="text-xs opacity-50">Due: {ms.due_date || 'TBD'} • ${ms.billable_amount.toLocaleString()}</p>
                              </div>
                          </div>
                          
                          <div className="flex gap-2">
                              <select className="bg-slate-800 border border-slate-600 text-xs rounded p-1 text-white uppercase font-bold" value={ms.status} onChange={(e) => onStatusChange(ms.id, e.target.value)} disabled={!!ms.invoice_id}><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option></select>
                              <button onClick={() => onAddTask(ms.id)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white" title="Add Task"><Plus size={14} /></button>
                              {!ms.invoice_id ? <button onClick={() => onInvoice(ms.id)} className="flex items-center gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded"><Receipt size={14} /> Bill Now</button> : <span className="flex items-center gap-2 text-xs font-bold text-green-500 border border-green-500/30 px-3 py-1 rounded bg-green-500/10"><Receipt size={14} /> BILLED</span>}
                          </div>
                      </div>

                      {/* LINKED TICKETS (Logic moved here for display) */}
                      {/* Note: Ideally tickets are passed in, or fetched here. We passed them via props in parent logic, need to filter here? */}
                      {/* For now, assuming parent handles filtering or we pass 'tickets' prop. Let's pass tickets prop */}
                      {/* WAIT: We need to filter. */}
                  </div>
              ))}
              {milestones?.length === 0 && <div className="text-center opacity-30 italic">No milestones defined.</div>}
          </div>
      </div>
  );
}