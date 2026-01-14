import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import OrgChart from '../components/OrgChart';
import api from '../lib/api';

// CONTEXT
import { useToast } from '../context/ToastContext';

// UI KIT IMPORTS
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

// SUB-COMPONENTS
import ClientInfoCard from '../components/clients/ClientInfoCard';
import ClientTicketList from '../components/clients/ClientTicketList';

// ICONS
import { 
  Loader2, ArrowLeft, Mail, Users, Edit2, Save, Plus, 
  Network, Phone, FileText, Download, Trash2
} from 'lucide-react';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  
  // === STATE ===
  const [client, setClient] = useState(null);
  const [audits, setAudits] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // === MODALS & EDITING ===
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  
  // === FORMS ===
  const [accountForm, setAccountForm] = useState({});
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer', reports_to_id: '' });
  const [dealForm, setDealForm] = useState({ title: '', amount: 0, stage: 'Infiltration', probability: 10 });
  const [projectForm, setProjectForm] = useState({ name: '', budget: '', due_date: '' });
  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'normal', description: '' });
  const [portalForm, setPortalForm] = useState({ email: '', password: '', full_name: '' });
  
  const [editingContactId, setEditingContactId] = useState(null);

  const isNaked = user?.scope === 'nt_only';
  const isGlobal = user?.scope === 'global';

  // === FETCH ===
  useEffect(() => { fetchDetail(); }, [id]);

  const fetchDetail = async () => {
    try {
      const response = await api.get(`/accounts/${id}`);
      setClient(response.data);
      setAccountForm({ 
        name: response.data.name, status: response.data.status, type: response.data.type, 
        brand_affinity: response.data.brand_affinity, billing_email: response.data.billing_email || '' 
      });
      api.get(`/audits?account_id=${id}`).then(res => setAudits(res.data));
      api.get(`/accounts/${id}/users`).then(res => setPortalUsers(res.data));
    } catch (err) { 
        console.error(err); 
        addToast("Failed to load client data", "error");
    } finally { setLoading(false); }
  };

  // === HANDLERS ===

  const saveAccount = async () => {
    try { 
        await api.put(`/accounts/${id}`, accountForm); 
        setIsEditingAccount(false); 
        fetchDetail();
        addToast("Account updated successfully", "success");
    } catch (err) { 
        addToast("Update failed: " + (err.response?.data?.detail || "Unknown error"), "error"); 
    }
  };

  const saveContact = async (e) => {
    e.preventDefault();
    try {
      const p = { ...contactForm, reports_to_id: contactForm.reports_to_id || null };
      if (editingContactId) await api.put(`/contacts/${editingContactId}`, p);
      else await api.post('/contacts', { ...p, account_id: id });
      
      setActiveModal(null); 
      fetchDetail(); 
      addToast(editingContactId ? "Contact updated" : "Contact added", "success");
    } catch (err) { addToast("Failed to save contact", "error"); }
  };

  const handleCreatePortalUser = async (e) => {
      e.preventDefault();
      try { 
          await api.post(`/accounts/${id}/users`, portalForm); 
          setActiveModal(null); 
          fetchDetail(); 
          addToast("Portal access granted", "success"); 
      } catch (e) { addToast("Failed to create user. Email may be duplicate.", "error"); }
  };

  const handleRevokeAccess = async (uid) => { 
      if(!confirm("Revoke access?")) return;
      try { 
          await api.delete(`/users/${uid}`); 
          fetchDetail(); 
          addToast("Access revoked", "info");
      } catch(e) { addToast("Revoke failed", "error"); } 
  };
  
  // Generic Create Handler
  const handleCreateGeneric = async (endpoint, data, resetForm) => {
      try { 
          await api.post(endpoint, { ...data, account_id: id }); 
          setActiveModal(null); 
          if(resetForm) resetForm(); 
          fetchDetail(); 
          addToast("Item created successfully", "success");
      } catch(e) { addToast("Failed to create item", "error"); }
  };

  const handleDeleteGeneric = async (endpoint, itemId) => {
      if(!confirm("Delete item?")) return;
      try { 
          await api.delete(`${endpoint}/${itemId}`); 
          fetchDetail(); 
          addToast("Item archived", "info");
      } catch(e){ addToast("Failed to delete", "error"); }
  };

  // === HELPERS ===
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';
  
  const openEditContact = (c) => { setEditingContactId(c.id); setContactForm(c); setActiveModal('contact'); };
  const openNewContact = () => { setEditingContactId(null); setContactForm({ first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer', reports_to_id: '' }); setActiveModal('contact'); };

  if (loading || !client) return <Layout title="Loading..."><div className="flex justify-center p-8"><Loader2 className="animate-spin text-white"/></div></Layout>;

  return (
    <Layout title="Client Profile">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/clients')} />
          {isEditingAccount ? (
            <input className="text-2xl font-bold bg-transparent border-b border-white outline-none text-white px-2 w-64" value={accountForm.name} onChange={(e) => setAccountForm({...accountForm, name: e.target.value})} />
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-white">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={client.status === 'client' ? 'success' : 'default'}>{client.status}</Badge>
                {isGlobal && <Badge variant="outline">{client.brand_affinity}</Badge>}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditingAccount ? (
            <>
              <Button variant="secondary" onClick={() => setIsEditingAccount(false)}>Cancel</Button>
              <Button variant="success" icon={Save} onClick={saveAccount}>Save</Button>
            </>
          ) : (
            <Button variant="secondary" icon={Edit2} onClick={() => setIsEditingAccount(true)}>Edit</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="space-y-8">
            <ClientInfoCard 
                client={client} 
                isEditing={isEditingAccount} 
                form={accountForm} 
                setForm={setAccountForm}
                isNaked={isNaked}
                onEdit={() => setIsEditingAccount(true)}
                onCancel={() => setIsEditingAccount(false)}
                onSave={saveAccount}
            />

            {/* PORTAL ACCESS */}
            <Card title="Portal Access" action={<Button variant="ghost" size="sm" icon={Plus} onClick={() => setActiveModal('portal')} />}>
                <div className="space-y-3">{portalUsers.map(u => (
                    <div key={u.id} className="flex justify-between items-center p-3 border-b border-gray-700/50 last:border-0">
                        <div><div className="font-bold text-sm text-white">{u.full_name}</div><div className="text-xs opacity-50">{u.email}</div></div>
                        <button onClick={() => handleRevokeAccess(u.id)} className="text-red-500 hover:text-red-400 text-xs font-bold uppercase">Revoke</button>
                    </div>
                ))}</div>
            </Card>

            {/* HUMANS */}
            <Card title="Humans" action={<Button variant="ghost" size="sm" icon={Plus} onClick={openNewContact} />}>
                <div className="space-y-4">{client.contacts.map(c => (
                    <div key={c.id} className="pb-4 border-b border-gray-700/50 last:border-0 last:pb-0 group relative">
                        <button onClick={() => openEditContact(c)} className="absolute right-0 top-0 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>
                        <div className="flex justify-between items-start">
                            <div><p className="font-bold text-white">{c.first_name} {c.last_name}</p><p className="text-xs font-bold uppercase mt-0.5 text-slate-500">{c.persona}</p></div>
                            {c.is_primary_contact && <span className="text-yellow-500 text-xs">⭐</span>}
                        </div>
                        <div className="flex flex-col gap-1 mt-2 text-xs opacity-70 text-slate-400">
                            {c.email && <div className="flex items-center gap-2"><Mail size={12} /> {c.email}</div>}
                            {c.phone && <div className="flex items-center gap-2"><Phone size={12} /> {c.phone}</div>}
                        </div>
                    </div>
                ))}</div>
            </Card>

            {/* RISK ASSESSMENTS */}
            <Card title="Risk Assessments" action={<Button variant="ghost" size="sm" icon={Plus} onClick={() => navigate('/audit')} />}>
              <div className="space-y-3">
                {audits.map(audit => (
                  <div key={audit.id} onClick={() => navigate(`/audit/${audit.id}`)} className="flex justify-between items-center p-3 border-b border-gray-700/50 last:border-0 cursor-pointer hover:bg-white/5 rounded transition-colors">
                    <div className="flex items-center gap-2">
                      <Badge variant={audit.security_score < 50 ? 'danger' : audit.security_score < 80 ? 'warning' : 'success'}>{audit.security_score}/100</Badge>
                      <span className="text-xs uppercase text-slate-400">{audit.status}</span>
                    </div>
                    <Download size={14} className="text-slate-500" />
                  </div>
                ))}
                {audits.length === 0 && <p className="opacity-50 text-sm italic">No audits.</p>}
              </div>
            </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* PROJECTS */}
            {!isNaked && (
              <Card title="Projects" action={<Button variant="ghost" size="sm" icon={Plus} onClick={() => setActiveModal('project')} />}>
                 <div className="space-y-2">
                    {client.projects?.map(p => (
                        <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-sanctum-gold/50 transition-colors group">
                            <div>
                                <div className="font-bold text-white flex items-center gap-2">
                                    {p.name}
                                    <Badge variant={p.status === 'active' ? 'success' : 'default'}>{p.status}</Badge>
                                </div>
                                <div className="text-xs opacity-50">Deadline: {p.due_date || 'TBD'}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-sanctum-gold">${p.budget.toLocaleString()}</span>
                                <button onClick={(e) => handleDeleteGeneric('/projects', p.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                 </div>
              </Card>
            )}

            {/* DEALS */}
            {!isNaked && (
              <Card title="Deals" action={<Button variant="ghost" size="sm" icon={Plus} onClick={() => setActiveModal('deal')} />}>
                <div className="space-y-2">
                    {client.deals.map(d => (
                      <div key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center cursor-pointer hover:border-blue-400/50 transition-colors">
                        <span className="font-medium text-white">{d.title}</span>
                        <div className="text-right">
                          <span className="block text-sanctum-gold font-mono">${d.amount.toLocaleString()}</span>
                          <Badge variant="info">{d.stage}</Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* FINANCIAL LEDGER */}
            <Card title="Financial Ledger">
             <div className="space-y-2">
                {(!client.invoices || client.invoices.length === 0) && (
                    <p className="opacity-50 text-sm italic">No invoices generated.</p>
                )}
                
                {client.invoices?.map(inv => (
                  <div key={inv.id} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between items-center group">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs opacity-50">#{inv.id.slice(0,8)}</span>
                            <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge>
                        </div>
                        <div className="text-xs opacity-50 mt-1">Due: {formatDate(inv.due_date)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-bold font-mono text-white">{formatCurrency(inv.total_amount)}</span>
                        <div className="flex gap-2">
                            <button onClick={() => navigate(`/invoices/${inv.id}`)} className="text-[10px] text-blue-400 hover:underline">Open</button>
                            <button onClick={() => handleDeleteGeneric('/invoices', inv.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                    </div>
                  </div>
                ))}
             </div>
          </Card>

            {/* TICKETS (Refactored) */}
            <ClientTicketList 
                tickets={client.tickets} 
                onAdd={() => setActiveModal('ticket')} 
                onDelete={(tid) => handleDeleteGeneric('/tickets', tid)} 
            />
        </div>
      </div>

      {/* --- MODALS --- */}
      
      <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title={editingContactId ? 'Edit Human' : 'Add Human'}>
        <form onSubmit={saveContact} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="First Name" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.first_name} onChange={e => setContactForm({...contactForm, first_name: e.target.value})} />
            <input required placeholder="Last Name" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.last_name} onChange={e => setContactForm({...contactForm, last_name: e.target.value})} />
          </div>
          <input placeholder="Email" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
          <input placeholder="Phone" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.persona} onChange={e => setContactForm({...contactForm, persona: e.target.value})}>
              <option>Decision Maker</option><option>Champion</option><option>Influencer</option><option>Blocker</option><option>End User</option>
            </select>
            <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={contactForm.reports_to_id} onChange={e => setContactForm({...contactForm, reports_to_id: e.target.value})}>
              <option value="">(No Manager)</option>
              {client.contacts.filter(c => c.id !== editingContactId).map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </Modal>

      <Modal isOpen={activeModal === 'deal'} onClose={() => setActiveModal(null)} title="New Deal">
        <form onSubmit={(e) => {e.preventDefault(); handleCreateGeneric('/deals', dealForm, () => setDealForm({title:'', amount:0, stage:'Infiltration', probability:10}))}} className="space-y-4">
          <input required placeholder="Deal Title" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={dealForm.title} onChange={e => setDealForm({...dealForm, title: e.target.value})} />
          <input type="number" placeholder="Value ($)" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={dealForm.amount} onChange={e => setDealForm({...dealForm, amount: e.target.value})} />
          <Button type="submit" className="w-full">Create Deal</Button>
        </form>
      </Modal>

      <Modal isOpen={activeModal === 'project'} onClose={() => setActiveModal(null)} title="New Project">
         <form onSubmit={(e) => {e.preventDefault(); handleCreateGeneric('/projects', {...projectForm, budget: parseFloat(projectForm.budget), due_date: projectForm.due_date || null}, () => setProjectForm({name:'', budget:'', due_date:''}))}} className="space-y-4">
           <input required placeholder="Project Name" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} />
           <div className="grid grid-cols-2 gap-4">
             <input type="number" placeholder="Budget" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={projectForm.budget} onChange={e => setProjectForm({...projectForm, budget: e.target.value})} />
             <input type="date" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={projectForm.due_date} onChange={e => setProjectForm({...projectForm, due_date: e.target.value})} />
           </div>
           <Button type="submit" className="w-full">Initialize Project</Button>
         </form>
      </Modal>

      <Modal isOpen={activeModal === 'ticket'} onClose={() => setActiveModal(null)} title="New Ticket">
         <form onSubmit={(e) => {e.preventDefault(); handleCreateGeneric('/tickets', ticketForm, () => setTicketForm({subject:'', description:'', priority:'normal'}))}} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                <option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
           </div>
           <input required placeholder="Subject" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} />
           <textarea placeholder="Description" className="w-full p-2 h-24 bg-slate-800 border border-slate-600 rounded text-white" value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} />
           <Button type="submit" className="w-full">Create Ticket</Button>
         </form>
      </Modal>

      <Modal isOpen={activeModal === 'portal'} onClose={() => setActiveModal(null)} title="Grant Access">
         <form onSubmit={handleCreatePortalUser} className="space-y-4">
            <input required placeholder="Full Name" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={portalForm.full_name} onChange={e => setPortalForm({...portalForm, full_name: e.target.value})} />
            <input required type="email" placeholder="Email" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={portalForm.email} onChange={e => setPortalForm({...portalForm, email: e.target.value})} />
            <input required type="password" placeholder="Password" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={portalForm.password} onChange={e => setPortalForm({...portalForm, password: e.target.value})} />
            <Button type="submit" className="w-full">Create Credentials</Button>
         </form>
      </Modal>

      {/* --- BOTTOM ROW --- */}
      <div className="mt-8">
          <Card title="Command Chain">
            <div className="w-full h-[400px] bg-black/20 rounded border border-white/5 relative overflow-hidden">
                {client.contacts.length > 0 ? <OrgChart contacts={client.contacts} /> : <div className="absolute inset-0 flex items-center justify-center opacity-30">Map humans to activate visualization.</div>}
            </div>
          </Card>
      </div>

    </Layout>
  );
}