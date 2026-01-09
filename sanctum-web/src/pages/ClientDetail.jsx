import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import OrgChart from '../components/OrgChart';
// Icons
import { 
  Loader2, ArrowLeft, Mail, Users, Shield, AlertCircle, Edit2, Save, X, Plus, 
  Network, Phone, DollarSign, FileText, Download, Clock, CheckCircle, Receipt, 
  Trash2, Briefcase, Bug, Zap, Clipboard, LifeBuoy, Key 
} from 'lucide-react';
import api from '../lib/api';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // === STATE: DATA ===
  const [client, setClient] = useState(null);
  const [audits, setAudits] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // === STATE: UI MODES ===
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  
  // === STATE: MODAL VISIBILITY ===
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);

  // === STATE: FORMS ===
  const [accountForm, setAccountForm] = useState({});
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer', reports_to_id: '' });
  const [dealForm, setDealForm] = useState({ title: '', amount: 0, stage: 'Infiltration', probability: 10 });
  const [projectForm, setProjectForm] = useState({ name: '', budget: '', due_date: '' });
  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'normal', description: '' });
  const [portalForm, setPortalForm] = useState({ email: '', password: '', full_name: '' });
  
  const [editingContactId, setEditingContactId] = useState(null);

  // === THEME & PERMISSIONS ===
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';
  const isGlobal = scope === 'global';

  const theme = {
    cardBg: isNaked ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700",
    textMain: isNaked ? "text-slate-900" : "text-white",
    textSub: isNaked ? "text-slate-500" : "text-slate-400",
    input: isNaked ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-black/20 border-white/10 text-white",
    modalBg: isNaked ? "bg-white" : "bg-slate-900 border border-slate-700 text-white",
    btnPrimary: isNaked ? "bg-naked-pink hover:bg-pink-600" : "bg-sanctum-blue hover:bg-blue-600"
  };

  // === INITIALIZATION ===
  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      // 1. Fetch Client
      const response = await api.get(`/accounts/${id}`);
      setClient(response.data);
      setAccountForm({ 
        name: response.data.name, 
        status: response.data.status, 
        type: response.data.type,
        brand_affinity: response.data.brand_affinity 
      });

      // 2. Fetch Audits
      const auditRes = await api.get(`/audits?account_id=${id}`);
      setAudits(auditRes.data);

      // 3. Fetch Portal Users
      api.get(`/accounts/${id}/users`).then(res => setPortalUsers(res.data));

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  // === HELPERS: FORMATTING & ICONS ===
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';
  
  const getTypeIcon = (type) => {
      switch(type) {
          case 'bug': return <Bug size={14} className="text-red-400" />;
          case 'feature': return <Zap size={14} className="text-yellow-400" />;
          case 'task': return <Clipboard size={14} className="text-blue-400" />;
          default: return <AlertCircle size={14} className="text-slate-400" />;
      }
  };

  // === HANDLERS: ACCOUNT ===
  const saveAccount = async () => {
    try {
      await api.put(`/accounts/${id}`, accountForm);
      setIsEditingAccount(false); fetchDetail();
    } catch (err) { alert("Update failed: " + err.response?.data?.detail); }
  };

  // === HANDLERS: CONTACTS ===
  const openEditContact = (c) => {
    setEditingContactId(c.id);
    setContactForm({
      first_name: c.first_name, last_name: c.last_name, email: c.email || '', 
      phone: c.phone || '', persona: c.persona || 'Influencer', reports_to_id: c.reports_to_id || ''
    });
    setShowContactModal(true);
  };

  const openNewContact = () => {
    setEditingContactId(null);
    setContactForm({ first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer', reports_to_id: '' });
    setShowContactModal(true);
  };

  const saveContact = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...contactForm };
      if (payload.reports_to_id === '') payload.reports_to_id = null;

      if (editingContactId) {
        await api.put(`/contacts/${editingContactId}`, payload);
      } else {
        await api.post('/contacts', { ...payload, account_id: id });
      }
      setShowContactModal(false); fetchDetail(); 
    } catch (err) { alert("Failed to save contact."); }
  };

  // === HANDLERS: PORTAL USERS ===
  const handleCreatePortalUser = async (e) => {
      e.preventDefault();
      try {
          await api.post(`/accounts/${id}/users`, portalForm);
          setShowPortalModal(false);
          setPortalForm({ email: '', password: '', full_name: '' });
          fetchDetail();
          alert("Access Granted. Credentials are live.");
      } catch (e) { alert("Failed to create user. Email might be duplicate."); }
  };

  const handleRevokeAccess = async (userId) => {
      if(!confirm("Revoke portal access for this user?")) return;
      try { await api.delete(`/users/${userId}`); fetchDetail(); } catch(e) { alert("Failed"); }
  };

  // === HANDLERS: PROJECTS & DEALS ===
  const saveDeal = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deals', { ...dealForm, account_id: id });
      setShowDealModal(false);
      setDealForm({ title: '', amount: 0, stage: 'Infiltration', probability: 10 });
      fetchDetail();
    } catch (err) { alert("Failed to create deal."); }
  };

  const saveProject = async (e) => {
      e.preventDefault();
      try {
          const payload = {
              account_id: id,
              name: projectForm.name,
              budget: parseFloat(projectForm.budget) || 0,
              due_date: projectForm.due_date ? projectForm.due_date : null
          };
          await api.post('/projects', payload);
          setShowProjectModal(false);
          setProjectForm({ name: '', budget: '', due_date: '' });
          fetchDetail();
      } catch (e) { alert("Failed to create project"); }
  };

  const handleDeleteProject = async (e, pId) => {
      e.stopPropagation();
      if(!confirm("Archive this project?")) return;
      try { await api.delete(`/projects/${pId}`); fetchDetail(); } catch(err) { alert("Failed"); }
  };

  // === HANDLERS: TICKETS & INVOICES ===
  const saveTicket = async (e) => {
      e.preventDefault();
      try {
          await api.post('/tickets', { ...ticketForm, account_id: id });
          setShowTicketModal(false);
          setTicketForm({ subject: '', priority: 'normal', description: '' });
          fetchDetail();
      } catch (e) { alert("Failed to create ticket"); }
  };

  const handleDeleteTicket = async (e, tId) => {
      e.stopPropagation();
      if(!confirm("Archive this ticket?")) return;
      try { await api.delete(`/tickets/${tId}`); fetchDetail(); } catch(err) { alert("Failed"); }
  };

  const handleDeleteInvoice = async (invId) => {
    if(!confirm("Permanently delete this invoice record?")) return;
    try { await api.delete(`/invoices/${invId}`); fetchDetail(); } catch (e) { alert("Failed to delete invoice"); }
  };


  // === RENDER START ===
  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;
  if (!client) return null;

  return (
    <Layout title="Client Profile">
      
      {/* --- HEADER SECTION --- */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="p-2 rounded-full hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          {isEditingAccount ? (
            <input value={accountForm.name} onChange={(e) => setAccountForm({...accountForm, name: e.target.value})} className={`text-2xl font-bold px-2 py-1 rounded border ${theme.input}`} />
          ) : (
            <div>
              <h1 className="text-3xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-green-500/20 text-green-500">{client.status}</span>
                {isGlobal && <span className="text-xs opacity-50 uppercase tracking-widest">{client.brand_affinity}</span>}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditingAccount ? (
            <>
              <button onClick={() => setIsEditingAccount(false)} className="px-4 py-2 rounded bg-gray-600 text-white text-sm">Cancel</button>
              <button onClick={saveAccount} className="px-4 py-2 rounded bg-green-600 text-white text-sm">Save</button>
            </>
          ) : (
            <button onClick={() => setIsEditingAccount(true)} className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${isNaked ? 'border-slate-300 hover:bg-slate-50' : 'border-white/20 hover:bg-white/5'}`}>
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT COLUMN --- */}
        <div className="space-y-8">
          
          {/* CARD: DETAILS */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <p className={`text-xs uppercase ${theme.textSub}`}>Status</p>
                {isEditingAccount ? (
                   <select value={accountForm.status} onChange={(e) => setAccountForm({...accountForm, status: e.target.value})} className={`w-full mt-1 p-2 rounded border ${theme.input}`}>
                     <option value="lead">Lead</option><option value="prospect">Prospect</option><option value="client">Active Client</option><option value="churned">Churned</option>
                   </select>
                ) : <p className={theme.textMain}>{client.status}</p>}
              </div>
              {!isNaked && isEditingAccount && (
                <div>
                  <p className={`text-xs uppercase ${theme.textSub}`}>Brand Sovereignty</p>
                  <select value={accountForm.brand_affinity} onChange={(e) => setAccountForm({...accountForm, brand_affinity: e.target.value})} className={`w-full mt-1 p-2 rounded border ${theme.input}`}>
                    <option value="ds">Digital Sanctum</option><option value="nt">Naked Tech</option><option value="both">Shared</option>
                  </select>
                </div>
              )}
              <div>
                <p className={`text-xs uppercase ${theme.textSub}`}>Type</p>
                {isEditingAccount ? (
                   <select value={accountForm.type} onChange={(e) => setAccountForm({...accountForm, type: e.target.value})} className={`w-full mt-1 p-2 rounded border ${theme.input}`}>
                     <option value="business">Business</option><option value="residential">Residential</option>
                   </select>
                ) : <p className={theme.textMain}>{client.type}</p>}
              </div>
            </div>
          </div>

          {/* CARD: PORTAL ACCESS */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                  <Key size={16} /> Portal Access
              </h3>
              <button onClick={() => setShowPortalModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`} title="Grant Access"><Plus size={16} /></button>
            </div>
            <div className="space-y-3">
              {portalUsers.length === 0 && <p className="opacity-50 text-sm">No external access granted.</p>}
              {portalUsers.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 border-b border-gray-500/20 last:border-0">
                      <div>
                          <div className={`font-bold text-sm ${theme.textMain}`}>{u.full_name}</div>
                          <div className="text-xs opacity-50">{u.email}</div>
                      </div>
                      <button onClick={() => handleRevokeAccess(u.id)} className="text-red-500 hover:text-red-400 text-xs font-bold uppercase">Revoke</button>
                  </div>
              ))}
            </div>
          </div>

          {/* CARD: CONTACTS */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2"><Users size={16} /> Humans</h3>
              <button onClick={openNewContact} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`}><Plus size={16} /></button>
            </div>
            <div className="space-y-4">
              {client.contacts.map(c => (
                <div key={c.id} className="pb-4 border-b border-gray-500/20 last:border-0 last:pb-0 group relative">
                  <button onClick={() => openEditContact(c)} className="absolute right-0 top-0 p-1.5 rounded bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"><Edit2 size={12} /></button>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-bold ${theme.textMain}`}>{c.first_name} {c.last_name}</p>
                      <p className={`text-xs font-bold uppercase mt-0.5 ${c.persona === 'Decision Maker' ? 'text-sanctum-gold' : 'text-slate-500'}`}>{c.persona}</p>
                    </div>
                    {c.is_primary_contact && <span className="text-yellow-500">⭐</span>}
                  </div>
                  <div className="flex flex-col gap-1 mt-2 text-xs opacity-70">
                    {c.email && <div className="flex items-center gap-2"><Mail size={12} /> {c.email}</div>}
                    {c.phone && <div className="flex items-center gap-2"><Phone size={12} /> {c.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CARD: RISK ASSESSMENTS */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
                <FileText size={16} /> Risk Assessments
              </h3>
              <button onClick={() => navigate('/audit')} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`} title="New Audit">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {audits.length === 0 && <p className="opacity-50 text-sm">No audits on file.</p>}
              {audits.map(audit => (
                <div key={audit.id} onClick={() => navigate(`/audit/${audit.id}`)} className="flex justify-between items-center p-3 border-b border-gray-500/20 last:border-0 pb-3 cursor-pointer hover:bg-white/5 transition-colors rounded">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${audit.security_score < 50 ? 'text-red-500' : audit.security_score < 80 ? 'text-orange-500' : 'text-green-500'}`}>{audit.security_score}/100</span>
                      <span className="text-xs opacity-50 uppercase">{audit.status}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-30">REF: {audit.id.slice(0,8)}</span>
                  </div>
                  {audit.report_pdf_path && <a href={audit.report_pdf_path} target="_blank" onClick={(e) => e.stopPropagation()} className="p-2 rounded hover:bg-white/10 text-sanctum-gold"><Download size={16} /></a>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN --- */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* CARD: PROJECTS */}
          {!isNaked && (
            <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 text-sanctum-gold flex items-center gap-2">
                    <Briefcase size={16} /> Projects
                </h3>
                <button onClick={() => setShowProjectModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`} title="New Project"><Plus size={16} /></button>
              </div>
              {client.projects?.length === 0 ? <p className="opacity-50 text-sm">No active projects.</p> : (
                  <div className="space-y-2">
                      {client.projects?.map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => navigate(`/projects/${p.id}`)} 
                            className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-sanctum-gold/50 transition-colors group"
                          >
                              <div>
                                  <div className="font-bold text-white flex items-center gap-2">
                                      {p.name}
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${p.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                                          {p.status}
                                      </span>
                                  </div>
                                  <div className="text-xs opacity-50">Deadline: {p.due_date || 'TBD'}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <span className="block font-mono text-sanctum-gold">${p.budget.toLocaleString()}</span>
                                  <button onClick={(e) => handleDeleteProject(e, p.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          )}

          {/* CARD: DEALS */}
          {!isNaked && (
            <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 text-blue-400 flex items-center gap-2"><Shield size={16} /> Deals</h3>
                <button onClick={() => setShowDealModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`}><Plus size={16} /></button>
              </div>
              {client.deals.length === 0 && <p className="opacity-50 text-sm">No active deals.</p>}
              {client.deals.map(d => (
                <div key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="p-3 bg-black/20 mb-2 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-blue-400/50 transition-colors">
                  <span className="font-medium">{d.title}</span>
                  <div className="text-right">
                    <span className="block text-sanctum-gold font-mono">${d.amount.toLocaleString()}</span>
                    <span className="text-[10px] uppercase opacity-50">{d.stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CARD: FINANCIAL LEDGER */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 text-green-500 flex items-center gap-2">
                <Receipt size={16} /> Financial Ledger
              </h3>
            </div>
            {client.invoices?.length === 0 ? (
              <p className="opacity-50 text-sm">No invoices generated.</p>
            ) : (
              <div className="space-y-2">
                {client.invoices?.map(inv => (
                  <div key={inv.id} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center group">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs opacity-50">#{inv.id.slice(0,8)}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${inv.status === 'paid' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                {inv.status}
                            </span>
                        </div>
                        <div className="text-xs opacity-50 mt-1">Due: {formatDate(inv.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block font-bold font-mono">{formatCurrency(inv.total_amount)}</span>
                            {inv.gst_amount > 0 && <span className="block text-[10px] opacity-40">(Inc. {formatCurrency(inv.gst_amount)} GST)</span>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => navigate(`/invoices/${inv.id}`)} className="text-[10px] text-blue-400 hover:underline">Open</button>
                            <button onClick={() => handleDeleteInvoice(inv.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD: TICKETS */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-pink-500 flex items-center gap-2">
                <AlertCircle size={16} /> Tickets
              </h3>
              <button onClick={() => setShowTicketModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`}><Plus size={16} /></button>
            </div>
            {client.tickets.length === 0 ? <p className="opacity-50 text-sm">No active tickets.</p> : (
              <div className="space-y-2">
                {client.tickets.map(t => (
                  <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-pink-500/50 transition-colors group">
                    <div>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(t.ticket_type)}
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${t.priority === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>{t.priority}</span>
                        <span className="font-medium text-sm">{t.subject}</span>
                      </div>
                      <span className="text-[10px] opacity-40 font-mono">#{t.id} • {t.status}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {t.status === 'resolved' ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
                        <button onClick={(e) => handleDeleteTicket(e, t.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- BOTTOM ROW: ORG CHART --- */}
      <div className="mt-8">
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-sanctum-gold flex items-center gap-2"><Network size={16} /> Command Chain</h3>
            <div className="w-full h-[400px] bg-black/20 rounded border border-white/5 relative overflow-hidden">
                {client.contacts.length > 0 ? (
                    <OrgChart contacts={client.contacts} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">Map humans to activate visualization.</div>
                )}
            </div>
          </div>
      </div>

      {/* --- MODALS --- */}

      {/* MODAL: CONTACT */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">{editingContactId ? 'Edit' : 'Add'} Human Intelligence</h2>
            <form onSubmit={saveContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="First Name" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.first_name} onChange={e => setContactForm({...contactForm, first_name: e.target.value})} />
                <input required placeholder="Last Name" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.last_name} onChange={e => setContactForm({...contactForm, last_name: e.target.value})} />
              </div>
              <input placeholder="Email" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
              <input placeholder="Phone" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.persona} onChange={e => setContactForm({...contactForm, persona: e.target.value})}>
                  <option>Decision Maker</option><option>Champion</option><option>Influencer</option><option>Blocker</option><option>End User</option>
                </select>
                <select className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.reports_to_id} onChange={e => setContactForm({...contactForm, reports_to_id: e.target.value})}>
                  <option value="">(No Manager)</option>
                  {client.contacts.filter(c => c.id !== editingContactId).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Save</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DEAL */}
      {showDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setShowDealModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><DollarSign size={20} /> New Revenue Opportunity</h2>
            <form onSubmit={saveDeal} className="space-y-4">
              <div>
                <label className="text-xs uppercase opacity-70 block mb-1">Deal Title</label>
                <input required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={dealForm.title} onChange={e => setDealForm({...dealForm, title: e.target.value})} placeholder="e.g. Q1 Network Upgrade" />
              </div>
              <div>
                <label className="text-xs uppercase opacity-70 block mb-1">Value ($)</label>
                <input type="number" required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={dealForm.amount} onChange={e => setDealForm({...dealForm, amount: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Stage</label>
                  <select className={`w-full p-2 rounded border outline-none ${theme.input}`} value={dealForm.stage} onChange={e => setDealForm({...dealForm, stage: e.target.value})}>
                    <option>Infiltration</option><option>Filtration</option><option>Diagnosis</option><option>Prescription</option><option>Accession</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Probability (%)</label>
                  <input type="number" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={dealForm.probability} onChange={e => setDealForm({...dealForm, probability: e.target.value})} />
                </div>
              </div>
              <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Initialize Deal</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROJECT (NEW) */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
                <button onClick={() => setShowProjectModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-6">Initialize Project</h2>
                <form onSubmit={saveProject} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Project Name</label>
                        <input required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} placeholder="e.g. Cloud Migration" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Budget ($)</label>
                            <input required type="number" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={projectForm.budget} onChange={e => setProjectForm({...projectForm, budget: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Due Date</label>
                            <input type="date" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={projectForm.due_date} onChange={e => setProjectForm({...projectForm, due_date: e.target.value})} />
                        </div>
                    </div>
                    <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Create Project</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL: TICKET (NEW) */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
                <button onClick={() => setShowTicketModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-6">Create Ticket</h2>
                <form onSubmit={saveTicket} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Subject</label>
                        <input required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} placeholder="e.g. User Cannot Login" />
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Priority</label>
                        <select className={`w-full p-2 rounded border outline-none ${theme.input}`} value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Create Ticket</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL: PORTAL USER (NEW) */}
      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
                <button onClick={() => setShowPortalModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">Grant Portal Access</h2>
                <form onSubmit={handleCreatePortalUser} className="space-y-4">
                    <input required placeholder="Full Name" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={portalForm.full_name} onChange={e => setPortalForm({...portalForm, full_name: e.target.value})} />
                    <input required type="email" placeholder="Email Address" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={portalForm.email} onChange={e => setPortalForm({...portalForm, email: e.target.value})} />
                    <input required type="password" placeholder="Password" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={portalForm.password} onChange={e => setPortalForm({...portalForm, password: e.target.value})} />
                    
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-500">
                        <strong>Warning:</strong> This user will have read-only access to all Tickets, Invoices, and Projects for this client.
                    </div>

                    <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Create Credentials</button>
                </form>
            </div>
        </div>
      )}

    </Layout>
  );
}