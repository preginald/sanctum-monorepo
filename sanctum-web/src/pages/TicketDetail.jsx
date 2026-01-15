import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
// ADDED: BookOpen, LinkIcon
import { Loader2, ArrowLeft, Save, Edit2, CheckCircle, Clock, FileText, User, X, Plus, Trash2, Package, Receipt, Copy, Briefcase, BookOpen, Link as LinkIcon } from 'lucide-react';
import api from '../lib/api';
import { TicketTypeIcon, StatusBadge, PriorityBadge } from '../components/tickets/TicketBadges';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
import { useToast } from '../context/ToastContext';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [ticket, setTicket] = useState(null);
  const [contacts, setContacts] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [accountProjects, setAccountProjects] = useState([]); 
  
  // NEW: Knowledge Base State
  const [allArticles, setAllArticles] = useState([]);
  const [showLinkArticle, setShowLinkArticle] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState('');

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editingTimeId, setEditingTimeId] = useState(null);
  const [timeEditForm, setTimeEditForm] = useState({});
  const [editingMatId, setEditingMatId] = useState(null);
  const [matEditForm, setMatEditForm] = useState({});

  const [newEntry, setNewEntry] = useState({ start_time: '', end_time: '', description: '', product_id: '' });
  const [newMaterial, setNewMaterial] = useState({ product_id: '', quantity: 1 });
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [showMatForm, setShowMatForm] = useState(false);
  
  const [formData, setFormData] = useState({
    status: '', priority: '', description: '', resolution: '', created_at: '', closed_at: '', 
    contact_ids: [], ticket_type: 'support', milestone_id: '', contact_id: ''
  });

  useEffect(() => { 
      fetchTicket(); 
      fetchCatalog();
      fetchArticles(); // Load articles for the linker
  }, [id]);

  useEffect(() => {
      if (ticket?.account_id) {
          api.get(`/projects?account_id=${ticket.account_id}`).then(res => setAccountProjects(res.data));
      }
  }, [ticket?.account_id]);

  const fetchTicket = async () => {
    try {
      const res = await api.get('/tickets'); 
      const target = res.data.find(t => t.id === parseInt(id));
      if (target) {
        setTicket(target);
        const existingIds = target.contacts ? target.contacts.map(c => c.id) : [];
        setFormData({
          status: target.status, priority: target.priority, description: target.description || '', resolution: target.resolution || '',
          created_at: target.created_at ? target.created_at.slice(0, 16) : '', closed_at: target.closed_at ? target.closed_at.slice(0, 16) : '',
          contact_ids: existingIds, ticket_type: target.ticket_type || 'support', milestone_id: target.milestone_id || '', contact_id: target.contact_id || ''
        });
        fetchContacts(target.account_id);
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const fetchContacts = async (accountId) => {
    try { const res = await api.get(`/accounts/${accountId}`); if (res.data?.contacts) setContacts(res.data.contacts); } catch (e) { }
  };

  const fetchCatalog = async () => {
    try { const res = await api.get('/products'); setProducts(res.data); } catch (e) { }
  };

  const fetchArticles = async () => {
      try { const res = await api.get('/articles'); setAllArticles(res.data); } catch(e) {}
  };

  const handleSave = async () => {
    const payload = { ...formData };
    if (!payload.closed_at) delete payload.closed_at;
    if (!payload.milestone_id) payload.milestone_id = null;
    if (!payload.contact_id) payload.contact_id = null;
    try { 
      await api.put(`/tickets/${id}`, payload); 
      await fetchTicket(); 
      setIsEditing(false); 
      addToast("Ticket updated successfully", "success");
    } catch (e) { 
      addToast("Update failed", "danger"); 
    }
  };

  // --- KNOWLEDGE BASE HANDLER ---
  const handleLinkArticle = async () => {
      if(!selectedArticleId) return;
      try {
          await api.post(`/tickets/${id}/articles/${selectedArticleId}`);
          addToast("Article linked", "success");
          setShowLinkArticle(false);
          setSelectedArticleId('');
          fetchTicket();
      } catch(e) {
          addToast("Failed to link article", "danger");
      }
  };

  const handleUnlinkArticle = async (e, articleId) => {
      e.stopPropagation(); // Prevent navigating to the article
      if(!confirm("Unlink this article?")) return;
      try {
          await api.delete(`/tickets/${id}/articles/${articleId}`);
          addToast("Article unlinked", "info");
          fetchTicket();
      } catch(e) {
          addToast("Failed to unlink", "danger");
      }
  };

  // --- SUB HANDLERS (Time/Material) ---
  const handleAddTime = async (e) => { 
    e.preventDefault(); 
    try { 
      await api.post(`/tickets/${id}/time_entries`, newEntry); 
      setNewEntry({ start_time: '', end_time: '', description: '', product_id: '' }); 
      setShowTimeForm(false); 
      fetchTicket(); 
      addToast("Time logged", "success");
    } catch (error) { 
      addToast("Failed to log time", "danger"); 
    } 
  };

  const startEditTime = (entry) => { setEditingTimeId(entry.id); setTimeEditForm({ start_time: entry.start_time.slice(0,16), end_time: entry.end_time.slice(0,16), description: entry.description, product_id: entry.product_id }); };
  
  const saveEditTime = async () => { 
    try { 
      await api.put(`/tickets/time_entries/${editingTimeId}`, timeEditForm); 
      setEditingTimeId(null); 
      fetchTicket(); 
      addToast("Time entry updated", "success");
    } catch(e) { 
      addToast("Failed to update time entry", "danger"); 
    } 
  };

  const handleDeleteTime = async (entryId) => { 
    if(!confirm("Remove log?")) return; 
    try { 
      await api.delete(`/tickets/${id}/time_entries/${entryId}`); 
      fetchTicket(); 
      addToast("Time entry removed", "info");
    } catch(e){ 
      addToast("Failed to remove time entry", "danger");
    } 
  };

  const handleDuplicateTime = async (entryId) => { 
    try { 
      await api.post(`/tickets/time_entries/${entryId}/duplicate`); 
      fetchTicket(); 
      addToast("Time entry duplicated", "success");
    } catch (e) { 
      addToast("Failed to duplicate entry", "danger"); 
    } 
  };

  const handleAddMaterial = async (e) => { 
    e.preventDefault(); 
    try { 
      await api.post(`/tickets/${id}/materials`, newMaterial); 
      setNewMaterial({ product_id: '', quantity: 1 }); 
      setShowMatForm(false); 
      fetchTicket(); 
      addToast("Material added", "success");
    } catch(e) { 
      addToast("Failed to add material", "danger"); 
    } 
  };

  const startEditMat = (mat) => { setEditingMatId(mat.id); setMatEditForm({ product_id: mat.product_id, quantity: mat.quantity }); };
  
  const saveEditMat = async () => { 
    try { 
      await api.put(`/tickets/materials/${editingMatId}`, matEditForm); 
      setEditingMatId(null); 
      fetchTicket(); 
      addToast("Material updated", "success");
    } catch(e) { 
      addToast("Failed to update material", "danger"); 
    } 
  };

  const handleDeleteMaterial = async (matId) => { 
    if(!confirm("Remove material?")) return; 
    try { 
      await api.delete(`/tickets/${id}/materials/${matId}`); 
      fetchTicket(); 
      addToast("Material removed", "info");
    } catch(e){ 
      addToast("Failed to remove material", "danger");
    } 
  };
  
  const handleGenerateInvoice = async () => { 
      if (ticket.related_invoices && ticket.related_invoices.length > 0) {
          const invIds = ticket.related_invoices.map(i => `#${i.id.slice(0,8)}`).join(', ');
          if (!confirm(`WARNING: This ticket is already linked to Invoice(s) ${invIds}. \n\nGenerate another invoice anyway?`)) {
              return;
          }
      } else {
          if(!confirm("Generate Draft Invoice from billable items?")) return; 
      }
      
      try { 
          const res = await api.post(`/tickets/${id}/invoice`); 
          addToast(`Invoice Generated! Total: $${res.data.total_amount}`, "success"); 
          navigate(`/clients/${ticket.account_id}`); 
      } catch(e) { 
          addToast(e.response?.data?.detail || "Failed to generate invoice", "danger"); 
      } 
  };

  // --- HELPERS ---
  const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';
  const formatDuration = (m) => `${Math.floor(m/60)}h ${m%60}m`;
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);
  const getEntryValue = (e) => e.calculated_value ?? ((e.duration_minutes / 60) * (e.product_id ? (products.find(p=>p.id===e.product_id)?.unit_price || 0) : 0));
  const getMatValue = (m) => m.calculated_value ?? (m.quantity * m.unit_price);

  if (loading || !ticket) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;
  const totalLaborValue = ticket.time_entries?.reduce((sum, e) => sum + getEntryValue(e), 0) || 0;
  const totalMatValue = ticket.materials?.reduce((sum, m) => sum + getMatValue(m), 0) || 0;

  return (
    <Layout title={`Ticket #${ticket.id}`}>
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div className="flex items-start gap-4 flex-1">
          <button onClick={() => navigate('/tickets')} className="p-2 rounded hover:bg-white/10 opacity-70 mt-1"><ArrowLeft size={20} /></button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
                <div className="p-1.5 bg-white/5 rounded border border-white/10 flex items-center justify-center"><TicketTypeIcon type={ticket.ticket_type} /></div>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
            </div>

            <h1 className="text-2xl font-bold leading-tight mb-2 break-words max-w-2xl">{ticket.subject}</h1>
            <div className="opacity-60 text-sm flex flex-wrap items-center gap-2">
              <button onClick={() => navigate(`/clients/${ticket.account_id}`)} className="hover:text-white hover:underline flex items-center gap-1 font-bold"><User size={12} /> {ticket.account_name}</button>
              {ticket.project_id && (<><span>/</span><button onClick={() => navigate(`/projects/${ticket.project_id}`)} className="flex items-center gap-1 hover:text-sanctum-gold transition-colors"><Briefcase size={12} /> {ticket.project_name}</button><span>/</span><span className="text-sanctum-gold">{ticket.milestone_name}</span></>)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
            {!isEditing && <button onClick={handleGenerateInvoice} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg"><Receipt size={16} /> Generate Invoice</button>}
            {!isEditing ? <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold"><Edit2 size={16} /> Edit</button> : <div className="flex gap-2"><button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 text-sm">Cancel</button><button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-blue text-white text-sm font-bold"><Save size={16} /> Save</button></div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: DETAILS, LINKED KNOWLEDGE, ITEMS */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          
          {/* FINANCIAL GUARD */}
          {ticket.related_invoices?.length > 0 && (
              <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <Receipt className="text-blue-400" size={20} />
                      <div>
                          <h4 className="text-sm font-bold text-blue-100">Billed Logic Active</h4>
                          <p className="text-xs text-blue-300">
                              Linked to: {ticket.related_invoices.map(i => (
                                  <span key={i.id} onClick={() => navigate(`/invoices/${i.id}`)} className="underline cursor-pointer ml-1">
                                      #{i.id.slice(0,8)} ({i.status})
                                  </span>
                              ))}
                          </p>
                      </div>
                  </div>
              </div>
          )}

          {/* TICKET DETAILS CARD */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative">
            {!isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs uppercase opacity-50 block mb-1">Status</label><StatusBadge status={ticket.status} /></div>
                  <div><label className="text-xs uppercase opacity-50 block mb-1">Priority</label><PriorityBadge priority={ticket.priority} /></div>
                </div>
                <div className="pt-2 border-t border-slate-800"><label className="text-xs uppercase opacity-50 block mb-2">Affected Humans</label><div className="flex flex-wrap gap-2">{ticket.contacts && ticket.contacts.length > 0 ? ticket.contacts.map(c => (<span key={c.id} className="bg-white/10 px-2 py-1 rounded text-xs flex items-center gap-1">{c.first_name} {c.last_name}</span>)) : <span className="text-xs opacity-30 italic">No contacts linked.</span>}</div></div>
                
                <div className="pt-2 border-t border-slate-800">
                    <div className="text-sm text-gray-300">
                        <SanctumMarkdown content={ticket.description || 'No description provided.'} />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs font-mono opacity-50"><div>Opened: {formatDate(ticket.created_at)}</div><div>{ticket.closed_at ? `Closed: ${formatDate(ticket.closed_at)}` : `Last Update: ${formatDate(ticket.updated_at)}`}</div></div>
                
                {ticket.resolution && (
                    <div className="pt-4 border-t border-slate-800">
                        <label className="text-xs uppercase opacity-50 block mb-2 text-green-400">Resolution</label>
                        <div className="p-3 bg-green-900/10 border border-green-900/30 rounded text-sm text-gray-300">
                            <SanctumMarkdown content={ticket.resolution} />
                        </div>
                    </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* EDIT FORM */}
                <div className="grid grid-cols-3 gap-6">
                    <div><label className="block text-xs uppercase opacity-50 mb-1">Status</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1">Priority</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1">Type</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.ticket_type || "support"} onChange={e => setFormData({...formData, ticket_type: e.target.value})}><option value="support">Support</option><option value="bug">Bug</option><option value="feature">Feature</option><option value="refactor">Refactor</option><option value="task">Task</option></select></div>
                </div>

                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Project / Milestone</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.milestone_id || ""} onChange={e => setFormData({...formData, milestone_id: e.target.value || null})}><option value="">(No Link)</option>{accountProjects.map(p => (<optgroup key={p.id} label={p.name}>{p.milestones.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</optgroup>))}</select></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-blue-400">Primary Contact</label><select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.contact_id || ""} onChange={e => setFormData({...formData, contact_id: e.target.value || null})}><option value="">-- None --</option>{contacts.map(c => (<option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>))}</select></div>
                </div>

                <div className="grid grid-cols-2 gap-6 p-4 bg-slate-800/50 rounded border border-slate-700">
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Opened</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.created_at} onChange={e => setFormData({...formData, created_at: e.target.value})} /></div>
                    <div><label className="block text-xs uppercase opacity-50 mb-1 text-yellow-400">Closed</label><input type="datetime-local" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm" value={formData.closed_at} onChange={e => setFormData({...formData, closed_at: e.target.value})} /></div>
                </div>
                <div><label className="block text-xs uppercase opacity-50 mb-1">Description</label><textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white font-mono text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <div className={formData.status === 'resolved' ? 'opacity-100' : 'opacity-50 grayscale'}><label className="block text-xs uppercase opacity-50 mb-1">Resolution</label><textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white" value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} disabled={formData.status !== 'resolved'} /></div>
              </div>
            )}
          </div>

          {/* NEW: KNOWLEDGE BASE CARD */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-400" /> Linked Knowledge</h3>
                  {!showLinkArticle && <button onClick={() => setShowLinkArticle(true)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"><LinkIcon size={12}/> Link Article</button>}
              </div>
              
              {showLinkArticle && (
                  <div className="mb-4 p-3 bg-black/30 rounded border border-purple-500/30 flex gap-2">
                      <select 
                        className="flex-1 bg-slate-800 text-xs p-2 rounded border border-slate-600"
                        value={selectedArticleId}
                        onChange={e => setSelectedArticleId(e.target.value)}
                      >
                          <option value="">Select an Article...</option>
                          {allArticles.map(a => (
                              <option key={a.id} value={a.id}>{a.identifier ? `${a.identifier} - ` : ''}{a.title}</option>
                          ))}
                      </select>
                      <button onClick={handleLinkArticle} disabled={!selectedArticleId} className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs font-bold">Link</button>
                      <button onClick={() => setShowLinkArticle(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                  </div>
              )}

<div className="space-y-2">
    {ticket.articles?.length > 0 ? ticket.articles.map(article => (
        <div key={article.id} onClick={() => navigate(`/wiki/${article.slug}`)} className="flex items-center justify-between p-3 bg-purple-900/10 border border-purple-500/20 hover:bg-purple-900/20 rounded cursor-pointer transition-colors group relative pr-8">
            <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">{article.identifier || 'WIKI'}</span>
                <span className="text-sm font-bold text-white group-hover:text-purple-200">{article.title}</span>
            </div>
            {/* Unlink Button (Visible on Hover) */}
            <button 
                onClick={(e) => handleUnlinkArticle(e, article.id)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Unlink"
            >
                <X size={14} />
            </button>
        </div>
    )) : (
        <p className="text-xs opacity-30 italic">No SOPs linked to this ticket.</p>
    )}
</div>
          </div>
          
          {/* BILLABLE TIME LOGS */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-4"><h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-sanctum-gold" /> Billable Labor</h3><span className="bg-sanctum-gold/10 text-sanctum-gold px-2 py-0.5 rounded text-xs font-bold border border-sanctum-gold/20">{formatCurrency(totalLaborValue)}</span></div>
                 <span className="text-xl font-mono font-bold text-white">{ticket.total_hours}h</span>
             </div>
             <div className="space-y-3">
                 {ticket.time_entries?.map(entry => (
                     <div key={entry.id} className="p-3 bg-white/5 rounded border border-white/5 text-sm group">
                         {editingTimeId === entry.id ? (
                             <div className="space-y-2">
                                 <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.start_time} onChange={e => setTimeEditForm({...timeEditForm, start_time: e.target.value})} /><input type="datetime-local" className="p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.end_time} onChange={e => setTimeEditForm({...timeEditForm, end_time: e.target.value})} /></div>
                                 <select className="w-full p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.product_id || ''} onChange={e => setTimeEditForm({...timeEditForm, product_id: e.target.value})}><option value="">(No Rate)</option>{products.filter(p => p.type === 'service').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}</select>
                                 <input className="w-full p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={timeEditForm.description} onChange={e => setTimeEditForm({...timeEditForm, description: e.target.value})} />
                                 <div className="flex gap-2"><button onClick={saveEditTime} className="flex-1 bg-green-600 rounded text-xs py-1 text-white font-bold">Save</button><button onClick={() => setEditingTimeId(null)} className="flex-1 bg-slate-600 rounded text-xs py-1 text-white">Cancel</button></div>
                             </div>
                         ) : (
                             <div className="flex justify-between items-center">
                                 <div><div className="font-mono text-xs opacity-50 mb-1">{formatDate(entry.start_time)} - {formatDate(entry.end_time)}</div><div className="font-bold flex items-center gap-2">{entry.description || "Work Session"}{entry.service_name && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] uppercase">{entry.service_name}</span>}</div><div className="text-xs text-sanctum-blue mt-1">Tech: {entry.user_name}</div></div>
                                 <div className="flex items-center gap-4"><div className="text-right"><span className="block font-mono font-bold">{formatDuration(entry.duration_minutes)}</span>{getEntryValue(entry) > 0 && <span className="block text-[10px] text-sanctum-gold opacity-70">{formatCurrency(getEntryValue(entry))}</span>}</div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDuplicateTime(entry.id)} className="text-slate-400 hover:text-sanctum-gold" title="Duplicate Entry"><Copy size={14}/></button><button onClick={() => startEditTime(entry)} className="text-slate-400 hover:text-white"><Edit2 size={14}/></button><button onClick={() => handleDeleteTime(entry.id)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button></div></div>
                             </div>
                         )}
                     </div>
                 ))}
             </div>
             {!showTimeForm && <button onClick={() => setShowTimeForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Log Time</button>}
             {showTimeForm && <form onSubmit={handleAddTime} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3"><div className="grid grid-cols-2 gap-3"><div><label className="text-xs opacity-50 block mb-1">Start</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newEntry.start_time} onChange={e => setNewEntry({...newEntry, start_time: e.target.value})} /></div><div><label className="text-xs opacity-50 block mb-1">End</label><input required type="datetime-local" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newEntry.end_time} onChange={e => setNewEntry({...newEntry, end_time: e.target.value})} /></div></div><div><label className="text-xs opacity-50 block mb-1">Rate / Service Type</label><select required className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newEntry.product_id} onChange={e => setNewEntry({...newEntry, product_id: e.target.value})}><option value="">-- Select Rate --</option>{products.filter(p => p.type === 'service').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price}/hr)</option>)}</select></div><div><label className="text-xs opacity-50 block mb-1">Description</label><input className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" placeholder="What was done?" value={newEntry.description} onChange={e => setNewEntry({...newEntry, description: e.target.value})} /></div><div className="flex gap-2"><button type="button" onClick={() => setShowTimeForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs">Cancel</button><button type="submit" className="flex-1 py-1 bg-sanctum-gold text-slate-900 font-bold rounded text-xs">Log Time</button></div></form>}
          </div>

          {/* BILLABLE MATERIALS */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
             <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-4"><h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Package className="w-4 h-4 text-orange-400" /> Materials Used</h3><span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-xs font-bold border border-orange-500/20">{formatCurrency(totalMatValue)}</span></div></div>
             <div className="space-y-3">
                 {ticket.materials?.map(mat => (
                     <div key={mat.id} className="p-3 bg-white/5 rounded border border-white/5 text-sm group">
                         {editingMatId === mat.id ? (
                             <div className="flex items-center gap-2"><select className="flex-1 p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={matEditForm.product_id} onChange={e => setMatEditForm({...matEditForm, product_id: e.target.value})}>{products.filter(p => p.type === 'hardware').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}</select><input type="number" className="w-16 p-1 rounded bg-black/40 border border-slate-600 text-xs text-white" value={matEditForm.quantity} onChange={e => setMatEditForm({...matEditForm, quantity: e.target.value})} /><button onClick={saveEditMat} className="bg-green-600 rounded p-1 text-white"><CheckCircle size={14}/></button><button onClick={() => setEditingMatId(null)} className="bg-slate-600 rounded p-1 text-white"><X size={14}/></button></div>
                         ) : (
                             <div className="flex justify-between items-center">
                                 <div><div className="font-bold">{mat.product_name}</div><div className="text-xs opacity-50">${mat.unit_price} x {mat.quantity}</div></div>
                                 <div className="flex items-center gap-4"><span className="font-mono font-bold text-orange-400">{formatCurrency(getMatValue(mat))}</span><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEditMat(mat)} className="text-slate-400 hover:text-white"><Edit2 size={14}/></button><button onClick={() => handleDeleteMaterial(mat.id)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button></div></div>
                             </div>
                         )}
                     </div>
                 ))}
             </div>
             {!showMatForm && <button onClick={() => setShowMatForm(true)} className="w-full py-2 mt-4 rounded bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Plus size={14} /> Add Item</button>}
             {showMatForm && <form onSubmit={handleAddMaterial} className="mt-4 p-4 bg-black/20 rounded border border-white/10 space-y-3"><div className="grid grid-cols-3 gap-3"><div className="col-span-2"><label className="text-xs opacity-50 block mb-1">Item</label><select required className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs text-white" value={newMaterial.product_id} onChange={e => setNewMaterial({...newMaterial, product_id: e.target.value})}><option value="">-- Select Product --</option>{products.filter(p => p.type === 'hardware').map(p => <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>)}</select></div><div><label className="text-xs opacity-50 block mb-1">Qty</label><input required type="number" className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-xs" value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} /></div></div><div className="flex gap-2"><button type="button" onClick={() => setShowMatForm(false)} className="flex-1 py-1 bg-slate-700 rounded text-xs">Cancel</button><button type="submit" className="flex-1 py-1 bg-orange-600 text-white font-bold rounded text-xs">Add</button></div></form>}
          </div>

        </div>

        <div className="h-[600px]">
          <CommentStream resourceType="ticket" resourceId={ticket.id} />
        </div>
      </div>
    </Layout>
  );
}