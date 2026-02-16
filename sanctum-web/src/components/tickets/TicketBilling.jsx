import React, { useState } from 'react';
import { Clock, Package, Plus, Edit2, Copy, Trash2, CheckCircle, X, Loader2, Lock, FileText, Send, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import SearchableSelect from '../ui/SearchableSelect';
import { Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TicketBilling({ ticket, products, onUpdate, triggerConfirm }) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  
  // --- TIME STATE ---
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ start_time: '', end_time: '', description: '', product_id: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  // --- MATERIAL STATE ---
  const [showMatForm, setShowMatForm] = useState(false);
  const [newMat, setNewMat] = useState({ product_id: '', quantity: 1 });
  const [loadingMatAction, setLoadingMatAction] = useState(false);

  // HELPERS
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleString() : '';
  const formatDuration = (m) => `${Math.floor(m/60)}h ${m%60}m`;

  // --- BADGE RENDERER ---
  const renderStatusBadge = (status, invoiceId) => {
      if (!status || !invoiceId) return null;
      
      const config = {
          'paid': { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'PAID' },
          'sent': { color: 'bg-blue-500/20 text-blue-400', icon: Send, label: 'SENT' },
          'draft': { color: 'bg-yellow-500/20 text-yellow-500', icon: FileText, label: 'DRAFT' },
          'void': { color: 'bg-red-500/20 text-red-400', icon: AlertCircle, label: 'VOID' }
      };

      const style = config[status.toLowerCase()] || config['draft'];
      const Icon = style.icon;

      return (
          <button 
            onClick={() => navigate(`/invoices/${invoiceId}`)}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider hover:opacity-80 transition-opacity ${style.color}`}
          >
              <Icon size={10} /> {style.label}
          </button>
      );
  };

  // --- ACTIONS (TIME) ---
  const handleAddTime = async (e) => {
      e.preventDefault();
      setLoadingAction(true);
      try {
          const payload = { ...newEntry };
          if (payload.start_time) payload.start_time = new Date(payload.start_time).toISOString();
          if (payload.end_time) payload.end_time = new Date(payload.end_time).toISOString();

          await api.post(`/tickets/${ticket.id}/time_entries`, payload);
          setNewEntry({ start_time: '', end_time: '', description: '', product_id: '' });
          setShowTimeForm(false);
          onUpdate(); 
          addToast("Time logged", "success");
      } catch(e) { 
          addToast("Failed to log time", "danger"); 
      } finally { 
          setLoadingAction(false); 
      }
  };

  const deleteTime = async (id) => {
      try {
          await api.delete(`/tickets/${ticket.id}/time_entries/${id}`);
          onUpdate();
          addToast("Deleted", "info");
      } catch(e) { addToast("Failed", "danger"); }
  };

  // --- ACTIONS (MATERIAL) ---
  const handleAddMat = async (e) => {
      e.preventDefault();
      setLoadingMatAction(true);
      try {
          await api.post(`/tickets/${ticket.id}/materials`, newMat);
          setNewMat({ product_id: '', quantity: 1 });
          setShowMatForm(false);
          onUpdate();
          addToast("Material added", "success");
      } catch(e) { addToast("Failed", "danger"); }
      finally { setLoadingMatAction(false); }
  };

  const deleteMat = async (id) => {
      try {
          await api.delete(`/tickets/${ticket.id}/materials/${id}`);
          onUpdate();
          addToast("Deleted", "info");
      } catch(e) { addToast("Failed", "danger"); }
  };

  const totalLabor = ticket.time_entries?.reduce((sum, e) => sum + (parseFloat(e.calculated_value) || 0), 0);
  const totalMat = ticket.materials?.reduce((sum, m) => sum + (parseFloat(m.calculated_value) || 0), 0);

  return (
    <div className="space-y-6">
        {/* TIME CARD */}
        <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-4">
                     <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-sanctum-gold" /> Billable Labor</h3>
                     <span className="bg-sanctum-gold/10 text-sanctum-gold px-2 py-0.5 rounded text-xs font-bold border border-sanctum-gold/20">{formatCurrency(totalLabor)}</span>
                 </div>
                 <span className="text-xl font-mono font-bold text-white">{ticket.total_hours}h</span>
             </div>
             
             <div className="space-y-3">
                 {ticket.time_entries?.map(entry => (
                     <div key={entry.id} className={`p-3 bg-white/5 rounded border text-sm group transition-colors ${entry.invoice_id ? 'border-green-500/10 bg-green-900/5' : 'border-white/5 hover:border-sanctum-gold/30'}`}>
                         <div className="flex justify-between items-center">
                             <div>
                                 <div className="font-mono text-xs opacity-50 mb-1 flex items-center gap-2">
                                    {formatDate(entry.start_time)} - {formatDate(entry.end_time)}
                                    {renderStatusBadge(entry.invoice_status, entry.invoice_id)}
                                 </div>
                                 <div className="font-bold flex items-center gap-2">
                                     {entry.description || "Work Session"}
                                     {entry.service_name && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] uppercase">{entry.service_name}</span>}
                                 </div>
                                 <div className="text-xs text-sanctum-blue mt-1">Tech: {entry.user_name}</div>
                             </div>
                             <div className="flex items-center gap-4">
                                 <div className="text-right">
                                     <span className="block font-mono font-bold">{formatDuration(entry.duration_minutes)}</span>
                                     <span className="block text-[10px] text-sanctum-gold opacity-70">{formatCurrency(entry.calculated_value)}</span>
                                 </div>
                                 
                                 {entry.invoice_id ? (
                                    <div className="flex items-center gap-1 opacity-50 cursor-not-allowed" title="Item is locked by an invoice">
                                        <Lock size={14} className="text-slate-500"/>
                                    </div>
                                 ) : (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => triggerConfirm("Delete Entry?", "This cannot be undone.", () => deleteTime(entry.id), true)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                                    </div>
                                 )}
                             </div>
                         </div>
                     </div>
                 ))}
             </div>

             {!showTimeForm && <button onClick={() => setShowTimeForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Log Time</button>}
             {showTimeForm && (
                 <form onSubmit={handleAddTime} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3 animate-in slide-in-from-top-2">
                     <div className="grid grid-cols-2 gap-3">
                         <div><label className="text-xs opacity-50 block mb-1">Start</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newEntry.start_time} onChange={e => setNewEntry({...newEntry, start_time: e.target.value})} /></div>
                         <div><label className="text-xs opacity-50 block mb-1">End</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newEntry.end_time} onChange={e => setNewEntry({...newEntry, end_time: e.target.value})} /></div>
                     </div>
                     
                 <div>
                     <label className="text-xs opacity-50 block mb-1">Rate</label>
                     <SearchableSelect 
                        items={products.filter(p => p.type === 'service')}
                        onSelect={(p) => setNewEntry({ ...newEntry, product_id: p.id })}
                        selectedIds={[newEntry.product_id]}
                        placeholder="Search Rates..."
                        labelKey="name"
                        subLabelKey="unit_price"
                        icon={Tag}
                        displaySelected={true}
                     />
                 </div>
                     <div><label className="text-xs opacity-50 block mb-1">Description</label><input className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newEntry.description} onChange={e => setNewEntry({...newEntry, description: e.target.value})} /></div>
                     <div className="flex gap-2">
                         <button type="button" onClick={() => setShowTimeForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs text-white">Cancel</button>
                         <button type="submit" disabled={loadingAction} className="flex-1 py-1 bg-sanctum-gold text-slate-900 font-bold rounded text-xs flex justify-center items-center gap-2">{loadingAction && <Loader2 size={12} className="animate-spin"/>} Log Time</button>
                     </div>
                 </form>
             )}
        </div>

        {/* MATERIAL CARD */}
        <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-4"><h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4 text-orange-400" /> Materials Used</h3><span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-xs font-bold border border-orange-500/20">{formatCurrency(totalMat)}</span></div></div>
             <div className="space-y-3">
                 {ticket.materials?.map(mat => (
                     <div key={mat.id} className={`p-3 bg-white/5 rounded border text-sm group transition-colors ${mat.invoice_id ? 'border-green-500/10 bg-green-900/5' : 'border-white/5 hover:border-orange-500/30'}`}>
                         <div className="flex justify-between items-center">
                             <div>
                                <div className="font-bold flex items-center gap-2">
                                    {mat.product_name}
                                    {renderStatusBadge(mat.invoice_status, mat.invoice_id)}
                                </div>
                                <div className="text-xs opacity-50">{formatCurrency(mat.unit_price)} x {mat.quantity}</div>
                            </div>
                             <div className="flex items-center gap-4">
                                 <span className="font-mono font-bold text-orange-400">{formatCurrency(mat.calculated_value)}</span>
                                 
                                 {mat.invoice_id ? (
                                    <div className="flex items-center gap-1 opacity-50 cursor-not-allowed" title="Item is locked by an invoice">
                                        <Lock size={14} className="text-slate-500"/>
                                    </div>
                                 ) : (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => triggerConfirm("Remove Item?", "Inventory will be adjusted.", () => deleteMat(mat.id), true)} className="text-red-500 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                                    </div>
                                 )}
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
             {!showMatForm && <button onClick={() => setShowMatForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Add Item</button>}
             {showMatForm && (
                 <form onSubmit={handleAddMat} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3 animate-in slide-in-from-top-2">
                     <div className="grid grid-cols-3 gap-3">
                     <div className="col-span-2">
                         <label className="text-xs opacity-50 block mb-1">Item</label>
                         <SearchableSelect 
                            items={products.filter(p => p.type === 'hardware' || p.type === 'license')}
                            onSelect={(p) => setNewMat({ ...newMat, product_id: p.id })}
                            selectedIds={[newMat.product_id]}
                            placeholder="Search Products..."
                            labelKey="name"
                            subLabelKey="unit_price"
                            icon={Package}
                            displaySelected={true}
                         />
                     </div>
                         <div><label className="text-xs opacity-50 block mb-1">Qty</label><input required type="number" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newMat.quantity} onChange={e => setNewMat({...newMat, quantity: e.target.value})} /></div>
                     </div>
                     <div className="flex gap-2">
                         <button type="button" onClick={() => setShowMatForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs text-white">Cancel</button>
                         <button type="submit" disabled={loadingMatAction} className="flex-1 py-1 bg-orange-600 text-white font-bold rounded text-xs flex justify-center items-center gap-2">{loadingMatAction && <Loader2 size={12} className="animate-spin"/>} Add</button>
                     </div>
                 </form>
             )}
        </div>
    </div>
  );
}