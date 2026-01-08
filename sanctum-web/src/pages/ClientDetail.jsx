import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import OrgChart from '../components/OrgChart';
// FIX: Added 'Trash2' to imports
import { Loader2, ArrowLeft, Mail, Users, Shield, AlertCircle, Edit2, Save, X, Plus, UserPlus, Network, Phone, DollarSign, FileText, Download, Clock, CheckCircle, Receipt, Trash2 } from 'lucide-react';
import api from '../lib/api';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [client, setClient] = useState(null);
  const [audits, setAudits] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // EDIT MODES
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState({});

  // MODALS
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);

  // FORMS
  const [contactForm, setContactForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer', reports_to_id: ''
  });
  const [dealForm, setDealForm] = useState({
    title: '', amount: 0, stage: 'Infiltration', probability: 10
  });
  const [editingContactId, setEditingContactId] = useState(null);

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

  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      const response = await api.get(`/accounts/${id}`);
      setClient(response.data);
      setAccountForm({ 
        name: response.data.name, 
        status: response.data.status, 
        type: response.data.type,
        brand_affinity: response.data.brand_affinity 
      });

      const auditRes = await api.get(`/audits?account_id=${id}`);
      setAudits(auditRes.data);

    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const saveAccount = async () => {
    try {
      await api.put(`/accounts/${id}`, accountForm);
      setIsEditingAccount(false); fetchDetail();
    } catch (err) { alert("Update failed: " + err.response?.data?.detail); }
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

  const saveDeal = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deals', { ...dealForm, account_id: id });
      setShowDealModal(false);
      setDealForm({ title: '', amount: 0, stage: 'Infiltration', probability: 10 });
      fetchDetail();
    } catch (err) { alert("Failed to create deal."); }
  };

  const handleDeleteInvoice = async (invId) => {
    if(!confirm("Permanently delete this invoice record?")) return;
    try {
        await api.delete(`/invoices/${invId}`);
        fetchDetail(); 
    } catch (e) {
        alert("Failed to delete invoice");
    }
  };

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

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;
  if (!client) return null;

  return (
    <Layout title="Client Profile">
      
      {/* HEADER */}
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
        
        {/* LEFT COLUMN */}
        <div className="space-y-8">
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

          {/* RISK ASSESSMENTS */}
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

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-sanctum-gold flex items-center gap-2"><Network size={16} /> Command Chain</h3>
            {client.contacts.length > 0 ? <OrgChart contacts={client.contacts} /> : <div className="h-32 flex items-center justify-center opacity-30 bg-black/20 rounded">Map humans to activate.</div>}
          </div>

          {!isNaked && (
            <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 text-sanctum-gold flex items-center gap-2"><Shield size={16} /> Deals</h3>
                <button onClick={() => setShowDealModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`}><Plus size={16} /></button>
              </div>
              {client.deals.length === 0 && <p className="opacity-50 text-sm">No active deals.</p>}
              {client.deals.map(d => (
                <div key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="p-3 bg-black/20 mb-2 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-sanctum-gold/50 transition-colors">
                  <span className="font-medium">{d.title}</span>
                  <div className="text-right">
                    <span className="block text-sanctum-gold font-mono">${d.amount.toLocaleString()}</span>
                    <span className="text-[10px] uppercase opacity-50">{d.stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FINANCIAL LEDGER */}
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
                        <div className="text-xs opacity-50 mt-1">
                            Due: {formatDate(inv.due_date)}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block font-bold font-mono">{formatCurrency(inv.total_amount)}</span>
                            {inv.gst_amount > 0 && (
                                <span className="block text-[10px] opacity-40">
                                    (Inc. {formatCurrency(inv.gst_amount)} GST)
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={() => navigate(`/invoices/${inv.id}`)} 
                            className="text-[10px] text-blue-400 hover:underline mt-1">
                            Open Invoice
                        </button>
                        {/* DELETE BUTTON */}
                        <button 
                            onClick={() => handleDeleteInvoice(inv.id)} 
                            className="p-2 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Invoice"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-pink-500 flex items-center gap-2">
                <AlertCircle size={16} /> Tickets
              </h3>
            </div>
            {client.tickets.length === 0 ? <p className="opacity-50 text-sm">No active tickets.</p> : (
              <div className="space-y-2">
                {client.tickets.map(t => (
                  <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-pink-500/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${t.priority === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>{t.priority}</span>
                        <span className="font-medium text-sm">{t.subject}</span>
                      </div>
                      <span className="text-[10px] opacity-40 font-mono">#{t.id} • {t.status}</span>
                    </div>
                    {t.status === 'resolved' ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-yellow-500" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
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

    </Layout>
  );
}