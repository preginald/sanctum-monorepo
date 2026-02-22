import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, Save, Edit2, User, Receipt, Briefcase, BookOpen, Link as LinkIcon, X, CheckCircle, Columns, Rows, Server, Plus, Check } from 'lucide-react';
import api from '../lib/api';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
import { ticketTypeStyles, ticketStatusStyles, priorityStyles } from '../lib/statusStyles';
import { TicketTypeIcon, StatusBadge, PriorityBadge } from '../components/tickets/TicketBadges';
import { useToast } from '../context/ToastContext';

// SUB-COMPONENTS
import TicketOverview from '../components/tickets/TicketOverview';
import TicketBilling from '../components/tickets/TicketBilling';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import ResolveModal from '../components/tickets/ResolveModal';
import SearchableSelect from '../components/ui/SearchableSelect';
import InvoiceList from '../components/invoices/InvoiceList'; // NEW IMPORT

export default function TicketDetail() {
  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setFormData({ ...formData, description: val });
    const cursor = e.target.selectionStart;
    const match = val.substring(0, cursor).match(/\{\{article:([^\}]*)$/);
    if (match) {
      if (availableArticles.length === 0) fetchArticles();
      setEmbedMenu({ active: true, query: match[1], startIndex: match.index, cursorIndex: cursor });
    } else {
      setEmbedMenu(prev => prev.active ? { active: false, query: '', startIndex: null, cursorIndex: null } : prev);
    }
  };

  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // --- STATE ---
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveText, setResolveText] = useState(''); 
  const [resolveId, setResolveId] = useState(null); 
  const [techs, setTechs] = useState([]); 

  const [showQuickMilestone, setShowQuickMilestone] = useState(false);
  const [showQuickTech, setShowQuickTech] = useState(false);

  // ASSET LINKING STATE
  const [clientAssets, setClientAssets] = useState([]);
  const [showLinkAsset, setShowLinkAsset] = useState(false);
  
  // DATA POOLS
  const [contacts, setContacts] = useState([]); 
  const [products, setProducts] = useState([]); 
  const [accountProjects, setAccountProjects] = useState([]); 
  const [allArticles, setAllArticles] = useState([]);

  // KNOWLEDGE BASE UI
  const [showLinkArticle, setShowLinkArticle] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState(''); 

  // FORM DATA (For Edit Mode)
  const [formData, setFormData] = useState({});

  // MODAL STATE
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', action: null, isDangerous: false });

  // LAYOUT STATE
  const [layoutMode, setLayoutMode] = useState(() => {
      return localStorage.getItem('sanctum_ticket_layout') || 'split';
  });

  // --- INITIALIZATION ---
  useEffect(() => { 
      fetchTicket(); 
      fetchCatalog();
      fetchArticles();
      fetchTechs();
  }, [id]);

  useEffect(() => {
      if (ticket?.account_id) {
          api.get(`/projects?account_id=${ticket.account_id}`).then(res => setAccountProjects(res.data));
          fetchContacts(ticket.account_id);
          api.get(`/assets?account_id=${ticket.account_id}`).then(res => setClientAssets(res.data));
      }
  }, [ticket?.account_id]);

    const fetchTechs = async () => {
      try {
          const res = await api.get('/admin/users'); 
          setTechs(res.data.filter(u => u.role !== 'client'));
      } catch (e) { 
          console.warn("Could not load tech roster", e);
      }
    };

  // --- API ---
  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}?resolve_embeds=true`);
      const target = res.data;
      if (target) {
        setTicket(target);
        setFormData({
          status: target.status, 
          priority: target.priority, 
          description: target.description || '', 
          resolution: target.resolution || '',
          created_at: target.created_at, 
          closed_at: target.closed_at,
          contact_ids: target.contacts?.map(c => c.id) || [], 
          ticket_type: target.ticket_type || 'support', 
          milestone_id: target.milestone_id || '', 
          assigned_tech_id: target.assigned_tech_id || null
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

  const handleSave = async () => {
    setIsSaving(true);
    const payload = { ...formData };
    if (!payload.closed_at) delete payload.closed_at;
    if (!payload.milestone_id) payload.milestone_id = null;
    try { 
      await api.put(`/tickets/${id}?resolve_embeds=true`, payload); 
      await fetchTicket(); 
      setIsEditing(false); 
      addToast("Ticket updated successfully", "success");
    } catch (e) { addToast("Update failed", "danger"); }
    finally { setIsSaving(false); }
  };

  const handleUpdateMilestone = async (milestoneId) => {
    try {
      await api.put(`/tickets/${id}?resolve_embeds=true`, { milestone_id: milestoneId });
      addToast("Milestone updated", "success");
      fetchTicket();
    } catch (e) { addToast("Failed to update milestone", "danger"); }
  };

  const handleUpdateTech = async (techId) => {
    try {
      await api.put(`/tickets/${id}?resolve_embeds=true`, { assigned_tech_id: techId });
      addToast("Assignee updated", "success");
      fetchTicket();
    } catch (e) { addToast("Failed to update assignee", "danger"); }
  };

  const handleLinkContact = async (contactId) => {
    if (isEditing) {
      const current = formData.contact_ids || [];
      if (!current.includes(contactId)) {
        setFormData({ ...formData, contact_ids: [...current, contactId] });
      }
      return;
    }
    const currentContactIds = ticket.contacts?.map(c => c.id) || [];
    if (currentContactIds.includes(contactId)) return;
    try {
      await api.put(`/tickets/${id}?resolve_embeds=true`, { contact_ids: [...currentContactIds, contactId] });
      addToast("Contact linked", "success");
      fetchTicket();
    } catch (e) { addToast("Failed to link contact", "danger"); }
  };

  const handleUnlinkContact = async (e, contactId) => {
    e.stopPropagation();
    if (isEditing) {
      const current = formData.contact_ids || [];
      setFormData({ ...formData, contact_ids: current.filter(cid => cid !== contactId) });
      return;
    }
    const newContactIds = ticket.contacts?.map(c => c.id).filter(cid => cid !== contactId);
    triggerConfirm("Unlink Contact?", "Remove this person from the ticket?", async () => {
      try {
        await api.put(`/tickets/${id}?resolve_embeds=true`, { contact_ids: newContactIds });
        addToast("Contact removed", "info");
        fetchTicket();
      } catch (e) { addToast("Failed to unlink", "danger"); }
    }, true);
  };

  const handleLinkAsset = async (assetId) => {
      try {
          await api.post(`/tickets/${id}/assets/${assetId}`);
          addToast("Asset linked", "success");
          setShowLinkAsset(false);
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

  const handleLinkArticle = async (articleId) => {
      try {
          await api.post(`/tickets/${id}/articles/${articleId}`);
          addToast("Article linked", "success");
          setShowLinkArticle(false);
          setArticleSearchQuery(''); 
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

  const handleGenerateInvoice = async () => {
    const unbilledCount = (ticket.time_entries?.filter(t => !t.invoice_id).length || 0) + (ticket.materials?.filter(m => !m.invoice_id).length || 0);
    
    if (unbilledCount === 0) return;

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

    const title = "Generate Invoice?";
    const message = `Ready to draft an invoice for ${unbilledCount} unbilled item(s)?`;
    triggerConfirm(title, message, proceed, false);
  };

  const handleResolve = async (resolutionText) => {
      setIsSaving(true);
      try {
          await api.put(`/tickets/${id}?resolve_embeds=true`, { status: 'resolved', resolution: resolutionText, closed_at: new Date().toISOString(), resolution_comment_id: resolveId });
          await fetchTicket();
          setShowResolveModal(false);
          addToast("Ticket Resolved Successfully", "success");
      } catch(e) { addToast("Failed to resolve ticket", "danger"); }
      finally { setIsSaving(false); }
  };

  const toggleLayout = () => {
    const newMode = layoutMode === 'split' ? 'stacked' : 'split';
    setLayoutMode(newMode);
    localStorage.setItem('sanctum_ticket_layout', newMode);
  };

  const triggerConfirm = (title, message, action, isDangerous = false) => {
      setModal({ isOpen: true, title, message, action, isDangerous });
  };

  const handlePinComment = (text, commentId) => {
      setResolveText(text);
      setResolveId(commentId); 
      setShowResolveModal(true);
  };

  if (loading || !ticket) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  const ticketStatusColor = (s) => {
    const map = { new: 'bg-blue-500/20 text-blue-400', open: 'bg-yellow-500/20 text-yellow-400', pending: 'bg-orange-500/20 text-orange-400', qa: 'bg-purple-500/20 text-purple-400', resolved: 'bg-green-500/20 text-green-400' };
    return map[s] || 'bg-white/10 text-slate-300';
  };

  // --- CALCULATE UNBILLED ITEMS ---
  const unbilledCount = (ticket.time_entries?.filter(t => !t.invoice_id).length || 0) + (ticket.materials?.filter(m => !m.invoice_id).length || 0);

  const ticketProject = accountProjects.find(p => p.milestones?.some(m => m.id === ticket.milestone_id));
  const breadcrumb = [
    { label: ticket.account_name, path: `/clients/${ticket.account_id}` },
    ...(ticketProject ? [{ label: ticketProject.name, path: `/projects/${ticketProject.id}` }] : []),
    ...(ticket.milestone_name ? [{ label: ticket.milestone_name }] : []),
  ];

  return (
    <Layout
      title={ticket.subject}
      breadcrumb={breadcrumb}
      badges={[
        { value: ticket.ticket_type, map: 'ticketType' },
        { value: ticket.status, map: 'ticketStatus' },
        { value: ticket.priority, map: 'priority' },
      ]}
      onRefresh={() => { fetchTicket(); setRefreshKey(k => k + 1); }}
      onCopyMeta={() => `#${ticket.id} — ${ticket.subject}\nStatus: ${ticket.status}\nPriority: ${ticket.priority}\nClient: ${ticket.account_name}`}
      viewMode={layoutMode}
      onViewToggle={toggleLayout}
      viewToggleOptions={[
        { value: 'split', icon: <Columns size={14} /> },
        { value: 'stacked', icon: <Rows size={14} /> }
      ]}
      actions={
        <div className="flex gap-2 items-center">
          {!isEditing && (
            <>
              {ticket.status !== 'resolved' && (
                <button onClick={() => setShowResolveModal(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"><CheckCircle size={16} /> Resolve</button>
              )}
              <button disabled={isSaving || unbilledCount === 0} onClick={handleGenerateInvoice} className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold shadow-lg transition-all ${unbilledCount === 0 ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-transparent' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                {isSaving ? <Loader2 size={16} className="animate-spin"/> : unbilledCount === 0 ? <><Check size={16} /> Fully Billed</> : <><Receipt size={16} /> Invoice ({unbilledCount})</>}
              </button>
            </>
          )}
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold"><Edit2 size={16} /> Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">Cancel</button>
              <button disabled={isSaving} onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-blue text-white text-sm font-bold disabled:opacity-50">{isSaving ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16} /> Save</>}</button>
            </div>
          )}
        </div>
      }
    >
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
        initialValue={resolveText} 
      />



        <div className={`grid gap-8 ${layoutMode === 'stacked' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-5'}`}>
        <div className="xl:col-span-3 space-y-6 min-w-0">
          <TicketOverview 
            ticket={ticket} isEditing={isEditing} formData={formData} setFormData={setFormData} contacts={contacts} accountProjects={accountProjects} techs={techs}
            onLinkContact={handleLinkContact} onUnlinkContact={handleUnlinkContact} onUpdateTech={handleUpdateTech} showQuickTech={showQuickTech} setShowQuickTech={setShowQuickTech}
            showQuickMilestone={showQuickMilestone} setShowQuickMilestone={setShowQuickMilestone} onUpdateMilestone={handleUpdateMilestone}
          />
          {/* KB Section */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-400" /> Linked Knowledge</h3>
                  {!showLinkArticle && <button onClick={() => setShowLinkArticle(true)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"><LinkIcon size={12}/> Link Article</button>}
              </div>
              {showLinkArticle && (
                  <div className="mb-4 p-3 bg-black/30 rounded border border-purple-500/30">
                      <div className="flex justify-end mb-2"><button onClick={() => setShowLinkArticle(false)} className="text-slate-500 hover:text-white"><X size={16}/></button></div>
                      <SearchableSelect items={allArticles} onSelect={(item) => handleLinkArticle(item.id)} selectedIds={ticket.articles?.map(a => a.id) || []} placeholder="Search Knowledge Base..." labelKey="title" subLabelKey="identifier" icon={BookOpen} />
                  </div>
              )}
              <div className="space-y-2">
                  {ticket.articles?.length > 0 ? ticket.articles.map(article => (
                      <div key={article.id} onClick={() => navigate(`/wiki/${article.slug}`)} className="flex items-center justify-between p-3 bg-purple-900/10 border border-purple-500/20 hover:bg-purple-900/20 rounded cursor-pointer transition-colors group relative pr-8">
                          <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">{article.identifier || 'WIKI'}</span>
                              <span className="text-sm font-bold text-white group-hover:text-purple-200">{article.title}</span>
                          </div>
                          <button onClick={(e) => handleUnlinkArticle(e, article.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>
                      </div>
                  )) : <p className="text-xs opacity-30 italic">No SOPs linked.</p>}
              </div>
          </div>
          {/* Assets Section */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Server className="w-4 h-4 text-cyan-400" /> Affected Assets</h3>
                  {!showLinkAsset && <button onClick={() => setShowLinkAsset(true)} className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded flex items-center gap-1"><LinkIcon size={12}/> Link Asset</button>}
              </div>
              {showLinkAsset && (
                  <div className="mb-4 p-3 bg-black/30 rounded border border-cyan-500/30">
                      <div className="flex justify-end mb-2"><button onClick={() => setShowLinkAsset(false)} className="text-slate-500 hover:text-white"><X size={16}/></button></div>
                      <SearchableSelect items={clientAssets} onSelect={(item) => handleLinkAsset(item.id)} selectedIds={ticket.assets?.map(a => a.id) || []} placeholder="Search Assets..." labelKey="name" subLabelKey="ip_address" icon={Server} />
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
                          <button onClick={(e) => handleUnlinkAsset(e, asset.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><X size={14} /></button>
                      </div>
                  )) : <p className="text-xs opacity-30 italic">No assets linked.</p>}
              </div>
          </div>
          <TicketBilling ticket={ticket} products={products} onUpdate={fetchTicket} triggerConfirm={triggerConfirm} />
          
          {/* NEW: Related Invoices Section */}
          <InvoiceList invoices={ticket.related_invoices || []} title="Related Invoices" />
          
        </div>
        <div className="xl:col-span-2 h-[800px] xl:sticky xl:top-8">
            <CommentStream resourceType="ticket" resourceId={ticket.id} onPromote={ticket.status !== 'resolved' ? handlePinComment : null} highlightId={ticket.resolution_comment_id} refreshKey={refreshKey} />
        </div>
      </div>
    </Layout>
  );
}