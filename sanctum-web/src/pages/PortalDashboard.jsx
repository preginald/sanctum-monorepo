import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import { Loader2, LogOut, Shield, AlertCircle, Receipt, Download, Briefcase, Plus, X } from 'lucide-react';
import api from '../lib/api';

export default function PortalDashboard() {
  const { user, logout } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // TICKET MODAL STATE
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false); // <--- NEW STATE
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal' });

  useEffect(() => { fetchPortal(); }, []);

  const fetchPortal = async () => {
    try {
      const res = await api.get('/portal/dashboard');
      setData(res.data);
    } catch (e) { 
      console.error(e);
      if(e.response?.status === 403) logout();
    } finally { setLoading(false); }
  };

  const handleCreateTicket = async (e) => {
      e.preventDefault();
      if (submitting) return; // Prevent double-click

      setSubmitting(true); // Lock UI
      try {
          await api.post('/tickets', { 
              ...ticketForm, 
              account_id: user.account_id, 
              ticket_type: 'support' 
          });
          setShowModal(false);
          setTicketForm({ subject: '', description: '', priority: 'normal' });
          fetchPortal(); 
          alert("Request sent successfully.");
      } catch (e) { 
          alert("Failed to send request."); 
      } finally {
          setSubmitting(false); // Unlock UI
      }
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  if (!data) return null;

  const { account, security_score, open_tickets, invoices, projects } = data;
  
  // DYNAMIC BRANDING
  const isNaked = account.brand_affinity === 'nt';
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    navBg: isNaked ? 'bg-white border-b border-slate-200' : 'bg-slate-900 border-b border-slate-800',
    btn: isNaked ? 'bg-naked-pink hover:bg-pink-600 text-white' : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900'
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => new Date(d).toLocaleDateString();

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
      
      {/* PORTAL NAVIGATION */}
      <nav className={`px-8 py-4 flex justify-between items-center ${theme.navBg}`}>
        <div>
            <h1 className={`text-xl font-bold ${theme.accent}`}>
                {isNaked ? 'Naked Tech' : 'SANCTUM'}
            </h1>
            <p className={`text-xs uppercase tracking-widest opacity-50`}>Client Portal • {account.name}</p>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm opacity-70">Hello, {user.full_name || 'Partner'}</span>
            <button onClick={logout} className="p-2 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Logout">
                <LogOut size={18} />
            </button>
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* TOP ROW: HEALTH & STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* SECURITY SCORE */}
            <div className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between`}>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <Shield size={16} /> Security Posture
                </h3>
                <div className="mt-4 flex items-end gap-2">
                    <span className={`text-5xl font-bold ${security_score < 50 ? 'text-red-500' : security_score < 80 ? 'text-orange-500' : 'text-green-500'}`}>
                        {security_score}
                    </span>
                    <span className="text-xl opacity-30 mb-1">/ 100</span>
                </div>
            </div>

            {/* OPEN TICKETS COUNT + BUTTON */}
            <div className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between`}>
                <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                        <AlertCircle size={16} /> Active Requests
                    </h3>
                    {/* NEW REQUEST BUTTON */}
                    <button onClick={() => setShowModal(true)} className={`p-2 rounded-lg ${theme.btn} shadow-lg transition-transform hover:-translate-y-1`}>
                        <Plus size={20} />
                    </button>
                </div>
                <div className="mt-4 text-5xl font-bold">
                    {open_tickets.length}
                </div>
            </div>

            {/* UNPAID INVOICES */}
            <div className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between`}>
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <Receipt size={16} /> Open Invoices
                </h3>
                <div className="mt-4 text-5xl font-bold">
                    {invoices.filter(i => i.status === 'sent').length}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* TICKET STREAM */}
            <div className={`p-6 rounded-xl border ${theme.card}`}>
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {open_tickets.length === 0 && <p className="text-sm opacity-50">No active tickets.</p>}
                    {open_tickets.slice(0, 5).map(t => (
                        <div key={t.id} className="p-3 rounded bg-black/5 dark:bg-white/5 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-sm">{t.subject}</div>
                                <div className="text-xs opacity-50">#{t.id} • {formatDate(t.created_at)}</div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${t.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-600'}`}>
                                {t.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* INVOICE HISTORY */}
            <div className={`p-6 rounded-xl border ${theme.card}`}>
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Billing History</h3>
                <div className="space-y-3">
                    {invoices.length === 0 && <p className="text-sm opacity-50">No invoice history.</p>}
                    {invoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="p-3 rounded bg-black/5 dark:bg-white/5 flex justify-between items-center">
                            <div>
                                <div className="font-bold font-mono text-sm">{formatCurrency(inv.total_amount)}</div>
                                <div className="text-xs opacity-50">#{inv.id.slice(0,8)} • {formatDate(inv.generated_at)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] uppercase font-bold ${inv.status === 'paid' ? 'text-green-500' : 'text-orange-500'}`}>
                                    {inv.status}
                                </span>
                                <button className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-50 hover:opacity-100`}>
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* PROJECTS SECTION */}
        {projects.length > 0 && (
            <div className={`p-6 rounded-xl border ${theme.card}`}>
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
                    <Briefcase size={16} /> Active Projects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects.map(p => {
                        const billed = p.milestones.reduce((sum, m) => m.invoice_id ? sum + m.billable_amount : sum, 0);
                        const progress = p.budget > 0 ? (billed / p.budget) * 100 : 0;
                        return (
                            <div key={p.id} className="p-4 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold">{p.name}</h4>
                                    <span className="text-xs opacity-50 uppercase">{p.status}</span>
                                </div>
                                <div className="text-xs opacity-50 mb-2">Due: {p.due_date || 'TBD'}</div>
                                
                                {/* Client-Facing Progress Bar */}
                                <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full ${isNaked ? 'bg-naked-pink' : 'bg-sanctum-gold'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] opacity-50">
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

      </main>

      {/* CREATE TICKET MODAL (CLIENT FACING) */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`p-6 rounded-xl w-full max-w-md relative shadow-2xl ${theme.card} ${isNaked ? 'text-slate-900' : 'text-white'}`}>
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4">How can we help?</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div>
                        <label className="text-xs uppercase opacity-50 block mb-1">Subject</label>
                        <input required className="w-full p-2 rounded bg-black/10 border border-slate-500/30" value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} placeholder="e.g. Need new email account" />
                    </div>
                    <div>
                        <label className="text-xs uppercase opacity-50 block mb-1">Urgency</label>
                        <select className="w-full p-2 rounded bg-black/10 border border-slate-500/30" value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                            <option value="low">Low (General Query)</option>
                            <option value="normal">Normal (Standard Request)</option>
                            <option value="high">High (Urgent Issue)</option>
                            <option value="critical">Critical (System Down)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase opacity-50 block mb-1">Details</label>
                        <textarea required className="w-full p-2 h-24 rounded bg-black/10 border border-slate-500/30 text-sm" value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} placeholder="Please describe the issue..." />
                    </div>
                    
                    {/* BUTTON WITH LOADING STATE */}
                    <button 
                        type="submit" 
                        disabled={submitting}
                        className={`w-full py-2 rounded font-bold flex justify-center items-center gap-2 ${theme.btn} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Submit Request'}
                    </button>
                </form>
            </div>
          </div>
      )}

    </div>
  );
}