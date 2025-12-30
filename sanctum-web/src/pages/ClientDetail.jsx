import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Mail, Users, Shield, FileText, AlertCircle, Edit2, Save, X, Plus, UserPlus } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // EDIT STATE (Account)
  const [isEditing, setIsEditing] = useState(false);
  const [accountForm, setAccountForm] = useState({});

  // CONTACT MODAL STATE
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer'
  });

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // THEME CONFIG
  const theme = {
    cardBg: isNaked ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700",
    textMain: isNaked ? "text-slate-900" : "text-white",
    textSub: isNaked ? "text-slate-500" : "text-slate-400",
    input: isNaked ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-black/20 border-white/10 text-white",
    modalBg: isNaked ? "bg-white" : "bg-slate-900 border border-slate-700 text-white",
    btnPrimary: isNaked ? "bg-naked-pink hover:bg-pink-600" : "bg-sanctum-blue hover:bg-blue-600"
  };

  useEffect(() => { fetchDetail(); }, [token, id]);

  const fetchDetail = async () => {
    try {
      const response = await api.get(`/accounts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setClient(response.data);
      setAccountForm({ name: response.data.name, status: response.data.status, type: response.data.type });
    } catch (err) { setError("Access Denied or Network Error"); }
    finally { setLoading(false); }
  };

  const saveAccount = async () => {
    try {
      await api.put(`/accounts/${id}`, accountForm, { headers: { Authorization: `Bearer ${token}` } });
      setIsEditing(false); fetchDetail();
    } catch (err) { alert("Update failed"); }
  };

  const createContact = async (e) => {
    e.preventDefault();
    try {
      await api.post('/contacts', { ...contactForm, account_id: id }, { headers: { Authorization: `Bearer ${token}` } });
      setShowContactModal(false);
      setContactForm({ first_name: '', last_name: '', email: '', phone: '', persona: 'Influencer' });
      fetchDetail(); // Refresh list
    } catch (err) { alert("Failed to add human."); }
  };

  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;
  if (!client) return null;

  return (
    <Layout title="Client Profile">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="p-2 rounded-full hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          {isEditing ? (
            <input value={accountForm.name} onChange={(e) => setAccountForm({...accountForm, name: e.target.value})} className={`text-2xl font-bold px-2 py-1 rounded border ${theme.input}`} />
          ) : (
            <div>
              <h1 className="text-3xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-green-500/20 text-green-500">{client.status}</span>
                <span className="text-xs opacity-50 uppercase tracking-widest">{client.id}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-gray-600 text-white text-sm">Cancel</button>
              <button onClick={saveAccount} className="px-4 py-2 rounded bg-green-600 text-white text-sm">Save</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className={`flex items-center gap-2 px-4 py-2 rounded border text-sm ${isNaked ? 'border-slate-300 hover:bg-slate-50' : 'border-white/20 hover:bg-white/5'}`}>
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN */}
        <div className="space-y-8">

          {/* INFO CARD */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <p className={`text-xs uppercase ${theme.textSub}`}>Status</p>
                {isEditing ? (
                   <select value={accountForm.status} onChange={(e) => setAccountForm({...accountForm, status: e.target.value})} className={`w-full mt-1 p-2 rounded border ${theme.input}`}>
                     <option value="lead">Lead</option><option value="prospect">Prospect</option><option value="client">Active Client</option>
                   </select>
                ) : <p className={theme.textMain}>{client.status}</p>}
              </div>
              <div>
                <p className={`text-xs uppercase ${theme.textSub}`}>Type</p>
                {isEditing ? (
                   <select value={accountForm.type} onChange={(e) => setAccountForm({...accountForm, type: e.target.value})} className={`w-full mt-1 p-2 rounded border ${theme.input}`}>
                     <option value="business">Business</option><option value="residential">Residential</option>
                   </select>
                ) : <p className={theme.textMain}>{client.type}</p>}
              </div>
            </div>
          </div>

          {/* CONTACTS CARD */}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2"><Users size={16} /> Humans</h3>
              <button onClick={() => setShowContactModal(true)} className={`p-1 rounded hover:bg-white/10 ${theme.textMain}`} title="Add Contact"><Plus size={16} /></button>
            </div>
            <div className="space-y-4">
              {client.contacts.map(c => (
                <div key={c.id} className="pb-4 border-b border-gray-500/20 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-bold ${theme.textMain}`}>{c.first_name} {c.last_name}</p>
                      <p className={`text-xs font-mono uppercase mt-0.5 ${c.persona === 'Decision Maker' ? 'text-green-500' : 'opacity-60'}`}>{c.persona || 'Unknown Role'}</p>
                    </div>
                    {c.is_primary_contact && <span title="Primary" className="text-yellow-500">⭐</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
                    <Mail size={12} /> {c.email}
                  </div>
                </div>
              ))}
              {client.contacts.length === 0 && <p className="opacity-50 text-sm">No humans mapped yet.</p>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Workflows) - Kept brief for space */}
        <div className="lg:col-span-2 space-y-8">
          {!isNaked && (
            <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-sanctum-gold flex items-center gap-2"><Shield size={16} /> Deals</h3>
              {client.deals.length === 0 && <p className="opacity-50 text-sm">No active deals.</p>}
              {client.deals.map(d => <div key={d.id} className="p-3 bg-black/20 mb-2 rounded border border-white/5 flex justify-between"><span>{d.title}</span><span className="text-sanctum-gold">${d.amount}</span></div>)}
            </div>
          )}
          <div className={`p-6 rounded-xl border ${theme.cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-pink-500 flex items-center gap-2"><AlertCircle size={16} /> Tickets</h3>
            {client.tickets.length === 0 && <p className="opacity-50 text-sm">No active tickets.</p>}
            {client.tickets.map(t => <div key={t.id} className="p-3 bg-black/20 mb-2 rounded border border-white/5 flex justify-between"><span>{t.subject}</span><span className="opacity-50">{t.status}</span></div>)}
          </div>
        </div>
      </div>

      {/* ADD CONTACT MODAL */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20} /></button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><UserPlus size={20} /> Map New Human</h2>

            <form onSubmit={createContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">First Name</label>
                  <input required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.first_name} onChange={e => setContactForm({...contactForm, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs uppercase opacity-70 block mb-1">Last Name</label>
                  <input required className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.last_name} onChange={e => setContactForm({...contactForm, last_name: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase opacity-70 block mb-1">Email</label>
                <input type="email" className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
              </div>

              <div>
                <label className="text-xs uppercase opacity-70 block mb-1">Persona Archetype</label>
                <select className={`w-full p-2 rounded border outline-none ${theme.input}`} value={contactForm.persona} onChange={e => setContactForm({...contactForm, persona: e.target.value})}>
                  <option value="Decision Maker">Decision Maker (Signs Checks)</option>
                  <option value="Champion">Champion (Internal Advocate)</option>
                  <option value="Influencer">Influencer (Technical Veto)</option>
                  <option value="Blocker">Blocker (The Problem)</option>
                  <option value="End User">End User (The Staff)</option>
                </select>
              </div>

              <button type="submit" className={`w-full py-3 mt-4 rounded font-bold text-white ${theme.btnPrimary}`}>Add to Hierarchy</button>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}
