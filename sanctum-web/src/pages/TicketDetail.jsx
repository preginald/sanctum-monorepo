import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, ArrowLeft, Save, Edit2, CheckCircle, Clock, FileText, User, X, Plus, Trash2, Package, Receipt, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [contacts, setContacts] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  // EDIT STATE FOR ITEMS
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeEditForm, setTimeEditForm] = useState({});
  
  const [editingMatId, setEditingMatId] = useState(null);
  const [matEditForm, setMatEditForm] = useState({});

  // Sub-Forms (Add New)
  const [newEntry, setNewEntry] = useState({ start_time: '', end_time: '', description: '', product_id: '' });
  const [newMaterial, setNewMaterial] = useState({ product_id: '', quantity: 1 });
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);
  
  const [formData, setFormData] = useState({
    status: '', priority: '', description: '', resolution: '', created_at: '', closed_at: '', contact_ids: [] 
  });

  useEffect(() => { 
      fetchTicket(); 
      fetchCatalog();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await api.get('/tickets'); 
      const target = res.data.find(t => t.id === parseInt(id));
      if (target) {
        setTicket(target);
        const existingIds = target.contacts ? target.contacts.map(c => c.id) : [];
        setFormData({
          status: target.status,
          priority: target.priority,
          description: target.description || '',
          resolution: target.resolution || '',
          created_at: target.created_at ? target.created_at.slice(0, 16) : '',
          closed_at: target.closed_at ? target.closed_at.slice(0, 16) : '',
          contact_ids: existingIds 
        });
        fetchContacts(target.account_id);
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const fetchContacts = async (accountId) => {
    try {
      const res = await api.get(`/accounts/${accountId}`);
      if (res.data?.contacts) setContacts(res.data.contacts);
    } catch (e) { }
  };

  const fetchCatalog = async () => {
      try {
          const res = await api.get('/products');
          setProducts(res.data);
      } catch (e) { }
  };

  // --- SAVE ACTIONS ---

  const handleSave = async () => {
    const payload = { ...formData };
    if (!payload.closed_at) delete payload.closed_at; 
    try {
      await api.put(`/tickets/${id}`, payload);
      await fetchTicket(); 
      setIsEditing(false); 
    } catch (e) { alert("Update failed"); }
  };

  // --- TIME ENTRY LOGIC ---

  const handleAddTime = async (e) => {
    e.preventDefault();
    try {
        await api.post(`/tickets/${id}/time_entries`, newEntry);
        setNewEntry({ start_time: '', end_time: '', description: '', product_id: '' });
        setShowTimeForm(false);
        fetchTicket(); 
    } catch (error) { alert("Failed to log time."); }
  };

  const startEditTime = (entry) => {
      setEditingTimeId(entry.id);
      // Ensure formatting for datetime-local
      setTimeEditForm({
          start_time: entry.start_time.slice(0,16),
          end_time: entry.end_time.slice(0,16),
          description: entry.description,
          product_id: entry.product_id
      });
  };

  const saveEditTime = async () => {
      try {
          await api.put(`/tickets/time_entries/${editingTimeId}`, timeEditForm);
          setEditingTimeId(null);
          fetchTicket();
      } catch(e) { alert("Failed to update time entry"); }
  };

  const handleDeleteTime = async (entryId) => {
    if(!confirm("Remove log?")) return;
    try { await api.delete(`/tickets/${id}/time_entries/${entryId}`); fetchTicket(); } catch(e){}
  };

  // --- MATERIAL LOGIC ---

  const handleAddMaterial = async (e) => {
      e.preventDefault();
      try {
          await api.post(`/tickets/${id}/materials`, newMaterial);
          setNewMaterial({ product_id: '', quantity: 1 });
          setShowMatForm(false);
          fetchTicket();
      } catch(e) { alert("Failed to add material"); }
  };

  const startEditMat = (mat) => {
      setEditingMatId(mat.id);
      setMatEditForm({
          product_id: mat.product_id,
          quantity: mat.quantity
      });
  };

  const saveEditMat = async () => {
      try {
          await api.put(`/tickets/materials/${editingMatId}`, matEditForm);
          setEditingMatId(null);
          fetchTicket();
      } catch(e) { alert("Failed to update material"); }
  };

  const handleDeleteMaterial = async (matId) => {
      if(!confirm("Remove material?")) return;
      try { await api.delete(`/tickets/${id}/materials/${matId}`); fetchTicket(); } catch(e){}
  };

  const handleGenerateInvoice = async () => {
      if(!confirm("Generate Draft Invoice from billable items?")) return;
      try {
          const res = await api.post(`/tickets/${id}/invoice`);
          alert(`Invoice Generated! Total: $${res.data.total_amount}`);
          navigate(`/clients/${ticket.account_id}`);
      } catch(e) { alert(e.response?.data?.detail || "Generation Failed"); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';
  const formatDuration = (m) => `${Math.floor(m/60)}h ${m%60}m`;

  if (loading || !ticket) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title={`Ticket #${ticket.id}`}>
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/tickets')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <p className="opacity-50 text-sm flex items-center gap-2">
              {ticket.account_name} 
              {ticket.contact_name && <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-xs text-sanctum-gold"><User size={10} /> {ticket.contact_name}</span>}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
            {!isEditing && (
                <button onClick={handleGenerateInvoice} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg">
                    <Receipt size={16} /> Generate Invoice
                </button>
            )}
            {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold">
                <Edit2 size={16} /> Edit
            </button>
            ) : (
            <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 text-sm">Cancel</button>
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-blue text-white text-sm font-bold"><Save size={16} /> Save</button>
            </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative">
            {!isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Status</label>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${ticket.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>{ticket.status}</span>
                  </div>
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Priority</label>
                    <span className="font-bold uppercase">{ticket.priority}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{ticket.description || 'No description.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-sm font-mono opacity-80">
                  <div>Opened: {formatDate(ticket.created_at)}</div>
                  <div>{ticket.closed_at ? `Closed: ${formatDate(ticket.closed_at)}` : `Updated: ${formatDate(ticket.updated_at)}`}</div>
                </div>
                {ticket.resolution && (
                  <div className="pt-4 border-t border-slate-800">
                    <label className="text-xs uppercase opacity-50 block mb-2 text-green-400">Resolution</label>
                    <div className="p-3 bg-green-900/10 border border-green-900/30 rounded text-sm text-gray-300">{ticket.resolution}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div><label className="block text-xs uppercase opacity-50 mb-1">Status</label><select className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1">Priority</label><select className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Opened (Time Travel)</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.created_at} onChange={e => setFormData({...formData, created_at: e.target.value})} /></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Closed (Time Travel)</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.closed_at} onChange={e => setFormData({...formData, closed_at: e.target.value})} /></div>
                </div>
                <div><label className="block text-xs uppercase opacity-50 mb-1">Description</label><textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <div className={formData.status === 'resolved' ? 'opacity-100' : 'opacity-50 grayscale'}><label className="block text-xs uppercase opacity-50 mb-1">Resolution</label><textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} disabled={formData.status !== 'resolved'} /></div>
              </div>
            )}
          </div>
          
          {/* BILLABLE TIME LOGS - WITH INLINE EDITING */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-sanctum-gold" /> Billable Labor</h3>
                 <span className="text-xl font-mono font-bold text-sanctum-gold">{ticket.total_hours}h</span>
             </div>
             <div className="space-y-3">
                 {ticket.time_entries?.map(entry => (
                     <div key={entry.id} className="p-3 bg-white/5 rounded border border-white/5 text-sm group">
                         {editingTimeId === entry.id ? (
                             <div className="space-y-2">
                                 <div className="grid grid-cols-2 gap-2">
                                     <input type="datetime-local" className="p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.start_time} onChange={e => setTimeEditForm({...timeEditForm, start_time: e.target.value})} />
                                     <input type="datetime-local" className="p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.end_time} onChange={e => setTimeEditForm({...timeEditForm, end_time: e.target.value})} />
                                 </div>
                                 <select className="w-full p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.product_id || ''} onChange={e => setTimeEditForm({...timeEditForm, product_id: e.target.value})}>
                                     <option value="">(No Rate)</option>
                                     {products.filter(p => p.type === 'service').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}
                                 </select>
                                 <input className="w-full p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.description} onChange={e => setTimeEditForm({...timeEditForm, description: e.target.value})} />
                                 <div className="flex gap-2">
                                     <button onClick={saveEditTime} className="flex-1 bg-green-600 rounded text-xs py-1 text-white font-bold">Save</button>
                                     <button onClick={() => setEditingTimeId(null)} className="flex-1 bg-slate-600 rounded text-xs py-1 text-white">Cancel</button>
                                 </div>
                             </div>
                         ) : (
                             <div className="flex justify-between items-center">
                                 <div>
                                     <div className="font-mono text-xs opacity-50 mb-1">{formatDate(entry.start_time)} - {formatDate(entry.end_time)}</div>
                                     <div className="font-bold flex items-center gap-2">
                                         {entry.description || "Work Session"}
                                         {entry.service_name && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] uppercase">{entry.service_name}</span>}
                                     </div>
                                     <div className="text-xs text-sanctum-blue mt-1">Tech: {entry.user_name}</div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     <span className="font-mono font-bold">{formatDuration(entry.duration_minutes)}</span>
                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button onClick={() => startEditTime(entry)} className="text-slate-400 hover:text-white"><Edit2 size={14}/></button>
                                         <button onClick={() => handleDeleteTime(entry.id)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button>
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                 ))}
                 {(!ticket.time_entries || ticket.time_entries.length === 0) && <div className="text-center opacity-30 italic py-4">No time logged.</div>}
             </div>
             {!showTimeForm && (
                 <button onClick={() => setShowTimeForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Log Time</button>
             )}
             {showTimeForm && (
                 <form onSubmit={handleAddTime} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3">
                     <div className="grid grid-cols-2 gap-3">
                         <div><label className="text-xs opacity-50 block mb-1">Start</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newEntry.start_time} onChange={e => setNewEntry({...newEntry, start_time: e.target.value})} /></div>
                         <div><label className="text-xs opacity-50 block mb-1">End</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newEntry.end_time} onChange={e => setNewEntry({...newEntry, end_time: e.target.value})} /></div>
                     </div>
                     <div>
                         <label className="text-xs opacity-50 block mb-1">Rate / Service Type</label>
                         <select required className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newEntry.product_id} onChange={e => setNewEntry({...newEntry, product_id: e.target.value})}>
                             <option value="">-- Select Rate --</option>
                             {products.filter(p => p.type === 'service').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price}/hr)</option>)}
                         </select>
                     </div>
                     <div><label className="text-xs opacity-50 block mb-1">Description</label><input className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" placeholder="What was done?" value={newEntry.description} onChange={e => setNewEntry({...newEntry, description: e.target.value})} /></div>
                     <div className="flex gap-2"><button type="button" onClick={() => setShowTimeForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs">Cancel</button><button type="submit" className="flex-1 py-1 bg-sanctum-gold text-slate-900 font-bold rounded text-xs">Log Time</button></div>
                 </form>
             )}
          </div>

          {/* BILLABLE MATERIALS - WITH INLINE EDITING */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4 text-orange-400" /> Materials Used</h3>
             </div>
             <div className="space-y-3">
                 {ticket.materials?.map(mat => (
                     <div key={mat.id} className="p-3 bg-white/5 rounded border border-white/5 text-sm group">
                         {editingMatId === mat.id ? (
                             <div className="flex items-center gap-2">
                                 <select className="flex-1 p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={matEditForm.product_id} onChange={e => setMatEditForm({...matEditForm, product_id: e.target.value})}>
                                     {products.filter(p => p.type === 'hardware').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}
                                 </select>
                                 <input type="number" className="w-16 p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={matEditForm.quantity} onChange={e => setMatEditForm({...matEditForm, quantity: e.target.value})} />
                                 <button onClick={saveEditMat} className="bg-green-600 rounded p-1 text-white"><CheckCircle size={14}/></button>
                                 <button onClick={() => setEditingMatId(null)} className="bg-slate-600 rounded p-1 text-white"><X size={14}/></button>
                             </div>
                         ) : (
                             <div className="flex justify-between items-center">
                                 <div>
                                     <div className="font-bold">{mat.product_name}</div>
                                     <div className="text-xs opacity-50">${mat.unit_price} x {mat.quantity}</div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     <span className="font-mono font-bold text-orange-400">${(mat.unit_price * mat.quantity).toFixed(2)}</span>
                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button onClick={() => startEditMat(mat)} className="text-slate-400 hover:text-white"><Edit2 size={14}/></button>
                                         <button onClick={() => handleDeleteMaterial(mat.id)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button>
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                 ))}
                 {(!ticket.materials || ticket.materials.length === 0) && <div className="text-center opacity-30 italic py-4">No materials used.</div>}
             </div>
             {!showMatForm && (
                 <button onClick={() => setShowMatForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Add Item</button>
             )}
             {showMatForm && (
                 <form onSubmit={handleAddMaterial} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3">
                     <div className="grid grid-cols-3 gap-3">
                         <div className="col-span-2">
                             <label className="text-xs opacity-50 block mb-1">Item</label>
                             <select required className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newMaterial.product_id} onChange={e => setNewMaterial({...newMaterial, product_id: e.target.value})}>
                                 <option value="">-- Select Product --</option>
                                 {products.filter(p => p.type === 'hardware').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}
                             </select>
                         </div>
                         <div><label className="text-xs opacity-50 block mb-1">Qty</label><input required type="number" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} /></div>
                     </div>
                     <div className="flex gap-2"><button type="button" onClick={() => setShowMatForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs">Cancel</button><button type="submit" className="flex-1 py-1 bg-orange-600 text-white font-bold rounded text-xs">Add</button></div>
                 </form>
             )}
          </div>

        </div>

        <div className="h-[600px]">
          <CommentStream resourceType="ticket" resourceId={ticket.id} />
        </div>
      </div>
    </Layout>
  );
}