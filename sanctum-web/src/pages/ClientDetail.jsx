import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { Loader2, Edit2, ArrowLeft, Activity, Ticket, Mail, Hash } from 'lucide-react';
import { useToast } from '../context/ToastContext';

// COMPONENTS
import HumanSection from '../components/clients/HumanSection';
import FinancialSection from '../components/clients/FinancialSection';
import ClientModals from '../components/clients/ClientModals';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import TicketCreateModal from '../components/tickets/TicketCreateModal';
import TicketList from '../components/tickets/TicketList';
// NEW ASSET COMPONENTS
import AssetList from '../components/clients/AssetList';
import AssetModal from '../components/clients/AssetModal';

// BADGES
const Badge = ({ children, color }) => (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${color}`}>
        {children}
    </span>
);

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToast();

  // STATE
  const [account, setAccount] = useState(null);
  const [users, setUsers] = useState([]);
  const [audits, setAudits] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]); // CMDB State

  const [loading, setLoading] = useState(true);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // FORM & MODAL STATE
  const [activeModal, setActiveModal] = useState(null);
  const [forms, setForms] = useState({
      contact: { first_name: '', last_name: '', email: '', phone: '', persona: '', reports_to_id: '' },
      project: { name: '', budget: 0, due_date: '' },
      deal: { title: '', amount: 0, stage: 'Infiltration', probability: 10 },
      user: { email: '', password: '', full_name: '' }
  });

  // ASSET FORM
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', asset_type: 'server', status: 'active', ip_address: '', serial_number: '', notes: '' });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: null });
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
      try {
          // Promise.all ensures we get everything before rendering
          const [accRes, auditRes, userRes, assetRes] = await Promise.all([
              api.get(`/accounts/${id}`),
              api.get(`/audits?account_id=${id}`),
              api.get(`/accounts/${id}/users`),
              api.get(`/assets?account_id=${id}`) // Fetch Assets
          ]);
          setAccount(accRes.data);
          setAudits(auditRes.data);
          setUsers(userRes.data);
          setAssets(assetRes.data);
          
          if (accRes.data.tickets) {
              const sorted = accRes.data.tickets.sort((a, b) => b.id - a.id);
              setTickets(sorted);
          }
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
  };

  const saveAccount = async () => {
      setIsSaving(true);
      try {
          await api.put(`/accounts/${id}`, { 
              name: account.name, 
              type: account.type, 
              brand_affinity: account.brand_affinity,
              status: account.status,
              billing_email: account.billing_email
          });
          setIsEditingAccount(false);
          addToast("Account updated", "success");
      } catch(e) { addToast("Update failed", "danger"); }
      finally { setIsSaving(false); }
  };

  const handleModalSubmit = async (e) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          if (activeModal === 'contact') {
              const payload = { ...forms.contact, account_id: id };
              if (payload.reports_to_id === '') payload.reports_to_id = null;

              if (forms.contact.id) await api.put(`/contacts/${forms.contact.id}`, payload);
              else await api.post('/contacts', payload);
              addToast(forms.contact.id ? "Contact updated" : "Contact added", "success");
          } else if (activeModal === 'project') {
              await api.post('/projects', { ...forms.project, account_id: id });
              addToast("Project initialized", "success");
          } else if (activeModal === 'deal') {
              await api.post('/deals', { ...forms.deal, account_id: id });
              addToast("Deal created", "success");
          } else if (activeModal === 'user') {
              await api.post(`/accounts/${id}/users`, forms.user);
              addToast("User provisioned", "success");
          }
          setActiveModal(null);
          fetchAll(); 
      } catch(e) { 
          console.error("Modal Submit Error:", e);
          let errorMsg = "Action failed";
          if (e.response?.data?.detail) {
              const detail = e.response.data.detail;
              if (Array.isArray(detail)) {
                  errorMsg = detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
              } else if (typeof detail === 'object') {
                  errorMsg = JSON.stringify(detail);
              } else {
                  errorMsg = detail;
              }
          }
          addToast(errorMsg, "danger"); 
      } finally { setIsSaving(false); }
  };

  // --- ASSET HANDLERS ---
  const handleAssetSubmit = async (e) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const payload = { ...assetForm, account_id: id };
          if (assetForm.id) await api.put(`/assets/${assetForm.id}`, payload);
          else await api.post('/assets', payload);
          addToast(assetForm.id ? "Asset updated" : "Asset deployed", "success");
          setShowAssetModal(false);
          fetchAll();
      } catch(e) { addToast("Asset action failed", "danger"); }
      finally { setIsSaving(false); }
  };

  const deleteAsset = async (aid) => {
      try { await api.delete(`/assets/${aid}`); addToast("Asset removed", "info"); fetchAll(); }
      catch(e) { addToast("Failed to delete", "danger"); }
  };

  const confirmAction = (title, message, action) => {
      setConfirmModal({ isOpen: true, title, message, action, isDangerous: true });
  };

  const deleteContact = async (cid) => {
      try { await api.delete(`/contacts/${cid}`); addToast("Contact removed", "info"); fetchAll(); } 
      catch(e) { addToast("Failed to remove", "danger"); }
  };

  const deleteTicket = async (tid) => {
      try { await api.delete(`/tickets/${tid}`); addToast("Ticket archived", "info"); fetchAll(); }
      catch(err) { addToast("Failed to delete", "danger"); }
  };

  const revokeUser = async (uid) => {
      try { await api.delete(`/users/${uid}`); addToast("Access revoked", "info"); fetchAll(); }
      catch(e) { addToast("Failed to revoke", "danger"); }
  };

  if (loading || !account) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title="Client Profile">
      
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({...confirmModal, isOpen: false})} 
        onConfirm={confirmModal.action} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        isDangerous={confirmModal.isDangerous}
      />

      <ClientModals 
        activeModal={activeModal} 
        onClose={() => setActiveModal(null)} 
        onSubmit={handleModalSubmit} 
        loading={isSaving} 
        forms={forms} 
        setForms={setForms} 
      />

      <TicketCreateModal 
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => { fetchAll(); addToast("Ticket created", "success"); }}
        preselectedAccountId={id}
      />

      <AssetModal 
        isOpen={showAssetModal} 
        onClose={() => setShowAssetModal(false)}
        onSubmit={handleAssetSubmit}
        loading={isSaving}
        form={assetForm}
        setForm={setAssetForm}
      />

      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
              <button onClick={() => navigate('/clients')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20}/></button>
              <div>
                  {isEditingAccount ? (
                      <div className="space-y-2">
                          <input className="text-3xl font-bold bg-black/40 border border-slate-600 rounded p-1 text-white w-full" value={account.name} onChange={e => setAccount({...account, name: e.target.value})} />
                          <div className="flex gap-2">
                              <select className="bg-black/40 border border-slate-600 rounded text-xs p-1" value={account.status} onChange={e => setAccount({...account, status: e.target.value})}><option value="lead">Lead</option><option value="prospect">Prospect</option><option value="active">Active</option><option value="churned">Churned</option></select>
                              <select className="bg-black/40 border border-slate-600 rounded text-xs p-1" value={account.type} onChange={e => setAccount({...account, type: e.target.value})}><option value="business">Business</option><option value="residential">Residential</option></select>
                          </div>
                          <input placeholder="Billing Email" className="text-sm bg-black/40 border border-slate-600 rounded p-1 text-white w-full font-mono" value={account.billing_email || ''} onChange={e => setAccount({...account, billing_email: e.target.value})} />
                      </div>
                  ) : (
                      <>
                        <h1 className="text-3xl font-bold">{account.name}</h1>
                        <div className="flex gap-2 mt-2">
                            <Badge color="bg-blue-600 text-white">{account.status}</Badge>
                            <Badge color="bg-slate-700 text-slate-300">{account.type}</Badge>
                            <Badge color={account.brand_affinity === 'ds' ? 'bg-sanctum-gold text-slate-900' : 'bg-naked-pink text-slate-900'}>{account.brand_affinity}</Badge>
                        </div>
                      </>
                  )}
              </div>
          </div>
          <div className="flex gap-2">
              {isEditingAccount ? (
                  <>
                      <button onClick={() => setIsEditingAccount(false)} className="px-4 py-2 rounded bg-slate-700 text-sm">Cancel</button>
                      <button onClick={saveAccount} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white font-bold">{isSaving && <Loader2 className="animate-spin" size={16}/>} Save</button>
                  </>
              ) : (
                  <button onClick={() => setIsEditingAccount(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold"><Edit2 size={16} /> Edit Profile</button>
              )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: FINANCIALS & PROJECTS */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* METADATA */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
                      <h4 className="text-xs text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Mail size={12}/> Billing Email</h4>
                      <p className="font-mono text-white text-sm">{account.billing_email || "N/A"}</p>
                  </div>
                  <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
                      <h4 className="text-xs text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Hash size={12}/> System ID</h4>
                      <p className="font-mono text-white text-xs">{account.id}</p>
                  </div>
              </div>

              <FinancialSection 
                  deals={account.deals || []} 
                  invoices={account.invoices || []} 
                  projects={account.projects || []}
                  isNaked={user?.scope === 'nt_only'}
                  onAddDeal={() => { setForms({...forms, deal: { title: '', amount: 0, stage: 'Infiltration', probability: 10 }}); setActiveModal('deal'); }}
                  onAddProject={() => { setForms({...forms, project: { name: '', budget: 0, due_date: '' }}); setActiveModal('project'); }}
              />
              
              {/* TICKETS */}
              <TicketList 
                tickets={tickets}
                onAdd={() => setShowTicketModal(true)}
                onDelete={(tid) => confirmAction("Archive Ticket?", "This will hide the ticket.", () => deleteTicket(tid))}
                title="Recent Tickets"
              />

              {/* ASSETS (CMDB) */}
              <AssetList 
                assets={assets} 
                onAdd={() => { setAssetForm({ name: '', asset_type: 'server', status: 'active' }); setShowAssetModal(true); }}
                onEdit={(a) => { setAssetForm(a); setShowAssetModal(true); }}
                onDelete={(aid) => confirmAction("Retire Asset?", "This cannot be undone.", () => deleteAsset(aid))}
              />

              {/* AUDITS */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
                          <Activity size={16} /> Audit History
                      </h3>
                      <button onClick={() => navigate(`/audit/new?account=${id}`)} className="text-xs bg-white/10 px-2 py-1 rounded hover:bg-white/20">New Audit</button>
                  </div>
                  <div className="space-y-2">
                      {audits.map(a => (
                          <div key={a.id} onClick={() => navigate(`/audit/${a.id}`)} className="flex justify-between p-3 bg-black/20 rounded border border-white/5 hover:border-white/20 cursor-pointer">
                              <span className="font-bold text-white">Security Audit</span>
                              <span className="text-xs opacity-50">{new Date(a.created_at).toLocaleDateString()} • Score: {a.security_score}</span>
                          </div>
                      ))}
                      {audits.length === 0 && <p className="text-sm opacity-30 italic">No audits performed.</p>}
                  </div>
              </div>
          </div>

          {/* RIGHT: HUMANS */}
          <div>
              <HumanSection 
                  contacts={account.contacts || []} 
                  users={users}
                  isEditing={isEditingAccount}
                  onAddContact={() => { setForms({...forms, contact: { first_name: '', last_name: '', email: '', phone: '', persona: '', reports_to_id: '' }}); setActiveModal('contact'); }}
                  onEditContact={(c) => { setForms({...forms, contact: c}); setActiveModal('contact'); }}
                  onDeleteContact={(cid) => confirmAction("Remove Contact?", "This action is permanent.", () => deleteContact(cid))}
                  onAddUser={() => { setForms({...forms, user: { email: '', full_name: '', password: '' }}); setActiveModal('user'); }}
                  onRevokeUser={(uid) => confirmAction("Revoke Access?", "User will no longer be able to login.", () => revokeUser(uid))}
              />
          </div>

      </div>
    </Layout>
  );
}