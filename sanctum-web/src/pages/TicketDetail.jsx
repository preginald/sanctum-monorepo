import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, ArrowLeft, Save, Edit2, User, Receipt, Briefcase, BookOpen, Link as LinkIcon, X, CheckCircle, Columns, Rows, Server } from 'lucide-react';
import api from '../lib/api';
import { TicketTypeIcon, StatusBadge, PriorityBadge } from '../components/tickets/TicketBadges';
import { useToast } from '../context/ToastContext';

// SUB-COMPONENTS
import TicketOverview from '../components/tickets/TicketOverview';
import TicketBilling from '../components/tickets/TicketBilling';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import ResolveModal from '../components/tickets/ResolveModal';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // --- STATE ---
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Global Save Lock
  const [showResolveModal, setShowResolveModal] = useState(false);

  // ASSET LINKING STATE
  const [clientAssets, setClientAssets] = useState([]);
  const [showLinkAsset, setShowLinkAsset] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  
  // DATA POOLS
  const [contacts, setContacts] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [accountProjects, setAccountProjects] = useState([]); 
  const [allArticles, setAllArticles] = useState([]);

  // KNOWLEDGE BASE UI
  const [showLinkArticle, setShowLinkArticle] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState('');

  // FORM DATA (For Edit Mode)
  const [formData, setFormData] = useState({});

  // MODAL STATE
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false });

  // --- INITIALIZATION ---
  useEffect(() => { 
      fetchTicket(); 
      fetchCatalog();
      fetchArticles();
  }, [id]);

  useEffect(() => {
      if (ticket?.account_id) {
          api.get(`/projects?account_id=${ticket.account_id}`).then(res => setAccountProjects(res.data));
          fetchContacts(ticket.account_id);
          // NEW: Fetch Client Assets
          api.get(`/assets?account_id=${ticket.account_id}`).then(res => setClientAssets(res.data));
      }
  }, [ticket?.account_id]);

  // --- API ---
  const fetchTicket = async () => {
    try {
      const res = await api.get('/tickets'); 
      const target = res.data.find(t => t.id === parseInt(id));
      if (target) {
        setTicket(target);
        // Hydrate Form Data
        setFormData({
          status: target.status, priority: target.priority, description: target.description || '', resolution: target.resolution || '',
          created_at: target.created_at, closed_at: target.closed_at,
          contact_ids: target.contacts?.map(c => c.id) || [], 
          ticket_type: target.ticket_type || 'support', 
          milestone_id: target.milestone_id || '', 
          contact_id: target.contact_id || ''
        });
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const fetchContacts = async (accountId) => {
    try { const res = await api.get(`/accounts/${accountId}`); if (res.data?.contacts) setContacts(res.data.contacts); } catch (e) { }
  };
  const fetchCatalog = async () => { try { const res = await api.get('/products'); setProducts(res.data); } catch (e) { } };
  const fetchArticles = async () => { try { const res = await api.get('/articles'); setAllArticles(res.data); } catch(e) {} };

  // LAYOUT STATE
  const [layoutMode, setLayoutMode] = useState(() => {
      return localStorage.getItem('sanctum_ticket_layout') || 'split';
  });

  const toggleLayout = () => {
      const newMode = layoutMode === 'split' ? 'stacked' : 'split';
      setLayoutMode(newMode);
      localStorage.setItem('sanctum_ticket_layout', newMode);
  };

  // --- HANDLERS ---
  const triggerConfirm = (title, message, action, isDangerous = false) => {
      setModal({ isOpen: true, title, message, action, isDangerous });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const payload = { ...formData };
    if (!payload.closed_at) delete payload.closed_at;
    if (!payload.milestone_id) payload.milestone_id = null;
    if (!payload.contact_id) payload.contact_id = null;
    try { 
      await api.put(`/tickets/${id}`, payload); 
      await fetchTicket(); 
      setIsEditing(false); 
      addToast("Ticket updated successfully", "success");
    } catch (e) { addToast("Update failed", "danger"); }
    finally { setIsSaving(false); }
  };

  const handleGenerateInvoice = async () => {
      const proceed = async () => {
          setIsSaving(true);
          try { 
              const res = await api.post(`/invoices/from_ticket/${id}`); 
              addToast(`Invoice Generated! Total: $${res.data.total_amount}`, "success"); 
              navigate(`/clients/${ticket.account_id}`); 
          } catch(e) { 
              addToast(e.response?.data?.detail || "Failed to generate invoice", "danger"); 
          } finally { setIsSaving(false); }
      };

      if (ticket.related_invoices && ticket.related_invoices.length > 0) {
          triggerConfirm("Duplicate Invoice?", "This ticket is already billed. Create another?", proceed, false);
      } else {
          triggerConfirm("Generate Invoice?", "This will draft an invoice for all billable items.", proceed, false);
      }
  };

  const handleResolve = async (resolutionText) => {
      setIsSaving(true);
      try {
          const payload = {
              status: 'resolved',
              resolution: resolutionText,
              closed_at: new Date().toISOString() // Explicit close time
          };
          
          await api.put(`/tickets/${id}`, payload);
          await fetchTicket();
          setShowResolveModal(false);
          addToast("Ticket Resolved Successfully", "success");
      } catch(e) {
          addToast("Failed to resolve ticket", "danger");
      } finally {
          setIsSaving(false);
      }
  };

  // --- ASSET HANDLERS ---
  const handleLinkAsset = async () => {
      if(!selectedAssetId) return;
      try {
          await api.post(`/tickets/${id}/assets/${selectedAssetId}`);
          addToast("Asset linked", "success");
          setShowLinkAsset(false);
          setSelectedAssetId('');
          fetchTicket();
      } catch(e) { addToast("Failed to link asset", "danger"); }
  };

  const handleUnlinkAsset = async (e, assetId) => {
      e.stopPropagation();
      triggerConfirm("Unlink Asset?", "This removes the reference.", async () => {
          try {
              await api.delete(`/tickets/${id}/assets/${assetId}`);
              addToast("Asset unlinked", "info");
              fetchTicket();
          } catch(e) { addToast("Failed to unlink", "danger"); }
      }, true);
  };


  // KNOWLEDGE HANDLERS
  const handleLinkArticle = async () => {
      if(!selectedArticleId) return;
      try {
          await api.post(`/tickets/${id}/articles/${selectedArticleId}`);
          addToast("Article linked", "success");
          setShowLinkArticle(false);
          setSelectedArticleId('');
          fetchTicket();
      } catch(e) { addToast("Failed to link article", "danger"); }
  };

  const handleUnlinkArticle = async (e, articleId) => {
      e.stopPropagation();
      triggerConfirm("Unlink Article?", "This reference will be removed.", async () => {
          try {
              await api.delete(`/tickets/${id}/articles/${articleId}`);
              addToast("Article unlinked", "info");
              fetchTicket();
          } catch(e) { addToast("Failed to unlink", "danger"); }
      }, true);
  };

  if (loading || !ticket) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title={`Ticket #${ticket.id}`}>
      <ConfirmationModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal({...modal, isOpen: false})} 
        onConfirm={modal.action} 
        title={modal.title} 
        message={modal.message} 
        isDangerous={modal.isDangerous}
      />

      <ResolveModal 
        isOpen={showResolveModal} 
        onClose={() => setShowResolveModal(false)} 
        onResolve={handleResolve} 
        loading={isSaving} 
      />

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

        {/* RIGHT SIDE BUTTONS */}
        <div className="flex gap-2">
            
            {/* LAYOUT TOGGLE */}
            <button 
                onClick={toggleLayout}
                className="p-2 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors mr-2"
                title={layoutMode === 'split' ? "Switch to Stacked View" : "Switch to Split View"}
            >
                {layoutMode === 'split' ? <Rows size={16} /> : <Columns size={16} />}
            </button>

            {!isEditing && (
                <>
                    {/* RESOLVE BUTTON (Only if not resolved) */}
                    {ticket.status !== 'resolved' && (
                        <button 
                            onClick={() => setShowResolveModal(true)} 
                            className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
                        >
                            <CheckCircle size={16} /> Resolve
                        </button>
                    )}
                    
                    <button disabled={isSaving} onClick={handleGenerateInvoice} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <><Receipt size={16} /> Generate Invoice</>}
                    </button>
                </>
            )}
            
            {/* EDIT / SAVE (Existing) */}
            {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold"><Edit2 size={16} /> Edit</button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 text-sm">Cancel</button>
                    <button disabled={isSaving} onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-blue text-white text-sm font-bold disabled:opacity-50">{isSaving ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16} /> Save</>}</button>
                </div>
            )}
        </div>
      </div>

        {/* DYNAMIC LAYOUT: Force stack if mode is 'stacked', else use responsive split */}
        <div className={`grid gap-8 ${layoutMode === 'stacked' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-5'}`}>
        
        {/* LEFT COLUMN (Content) */}
        <div className="xl:col-span-3 space-y-6 min-w-0">
          
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

          {/* OVERVIEW */}
          <TicketOverview 
            ticket={ticket} 
            isEditing={isEditing} 
            formData={formData} 
            setFormData={setFormData} 
            contacts={contacts} 
            accountProjects={accountProjects} 
          />

          {/* KNOWLEDGE BASE */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-400" /> Linked Knowledge</h3>
                  {!showLinkArticle && <button onClick={() => setShowLinkArticle(true)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"><LinkIcon size={12}/> Link Article</button>}
              </div>
              
              {showLinkArticle && (
                  <div className="mb-4 p-3 bg-black/30 rounded border border-purple-500/30 flex gap-2">
                      <select className="flex-1 bg-slate-800 text-xs p-2 rounded border border-slate-600" value={selectedArticleId} onChange={e => setSelectedArticleId(e.target.value)}>
                          <option value="">Select an Article...</option>
                          {allArticles.map(a => (<option key={a.id} value={a.id}>{a.identifier ? `${a.identifier} - ` : ''}{a.title}</option>))}
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
                          <button onClick={(e) => handleUnlinkArticle(e, article.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Unlink"><X size={14} /></button>
                      </div>
                  )) : <p className="text-xs opacity-30 italic">No SOPs linked to this ticket.</p>}
              </div>
          </div>

          {/* AFFECTED ASSETS */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <Server className="w-4 h-4 text-cyan-400" /> Affected Assets
                  </h3>
                  {!showLinkAsset && (
                      <button onClick={() => setShowLinkAsset(true)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1">
                          <LinkIcon size={12}/> Link Asset
                      </button>
                  )}
              </div>
              
              {showLinkAsset && (
                  <div className="mb-4 p-3 bg-black/30 rounded border border-cyan-500/30 flex gap-2">
                      <select 
                        className="flex-1 bg-slate-800 text-xs p-2 rounded border border-slate-600" 
                        value={selectedAssetId} 
                        onChange={e => setSelectedAssetId(e.target.value)}
                      >
                          <option value="">Select Asset...</option>
                          {clientAssets.map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({a.ip_address})</option>
                          ))}
                      </select>
                      <button onClick={handleLinkAsset} disabled={!selectedAssetId} className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs font-bold">Link</button>
                      <button onClick={() => setShowLinkAsset(false)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                  </div>
              )}

              <div className="space-y-2">
                  {ticket.assets?.length > 0 ? ticket.assets.map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-3 bg-cyan-900/10 border border-cyan-500/20 hover:bg-cyan-900/20 rounded cursor-pointer transition-colors group relative pr-8">
                          <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase">{asset.asset_type}</span>
                              <span className="text-sm font-bold text-white">{asset.name}</span>
                              {asset.ip_address && <span className="text-xs opacity-50 font-mono">({asset.ip_address})</span>}
                          </div>
                          <button onClick={(e) => handleUnlinkAsset(e, asset.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all" title="Unlink"><X size={14} /></button>
                      </div>
                  )) : (
                      <p className="text-xs opacity-30 italic">No assets linked.</p>
                  )}
              </div>
          </div>
          
          {/* BILLING SECTION */}
          <TicketBilling 
            ticket={ticket} 
            products={products} 
            onUpdate={fetchTicket} 
            triggerConfirm={triggerConfirm} 
          />

        </div>

        {/* RIGHT COLUMN (Stream) - Spans 2 cols (40%) */}
        <div className="xl:col-span-2 h-[800px] xl:sticky xl:top-8">
          <CommentStream resourceType="ticket" resourceId={ticket.id} />
        </div>
      </div>
    </Layout>
  );
}