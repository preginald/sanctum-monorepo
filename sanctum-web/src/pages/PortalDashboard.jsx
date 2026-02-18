import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Loader2, LogOut, Shield, AlertCircle, Receipt, Download, Briefcase, Plus, X, Server, ArrowRight, TrendingUp, Globe, Zap, RotateCcw, Star, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import { Card, StatWidget, StatusBadge, ScoreDisplay, HealthScoreWidget, usePortalTheme } from '../components/portal';
import QuestionnaireBanner from '../components/portal/QuestionnaireBanner';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useToast } from '../context/ToastContext';
import usePortalNav from '../hooks/usePortalNav';

// PHASE 60A: Category Widget Configuration
const CATEGORY_WIDGETS = [
  { key: 'security', label: 'Security', icon: Shield, color: 'blue' },
  { key: 'infrastructure', label: 'Infrastructure', icon: Server, color: 'purple' },
  { key: 'digital', label: 'Digital Presence', icon: Globe, color: 'green' },
  { key: 'efficiency', label: 'Efficiency', icon: Zap, color: 'yellow' },
  { key: 'continuity', label: 'Resilience', icon: RotateCcw, color: 'orange' },
  { key: 'ux', label: 'Support', icon: Star, color: 'pink' }
];

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { portalNav, impersonateId: impId } = usePortalNav();
  const { user, logout } = useAuthStore();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const impersonateId = impId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  
  // TICKET MODAL STATE
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false); 
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [downloadingInv, setDownloadingInv] = useState(null);

  useEffect(() => { fetchPortal(); }, []);

const fetchPortal = async () => {
    try {
      const url = impersonateId 
        ? `/portal/dashboard?impersonate=${impersonateId}` 
        : '/portal/dashboard';
      const res = await api.get(url);
      setData(res.data);
    } catch (e) { 
      console.error(e);
      if(e.response?.status === 403) logout();
    } finally { setLoading(false); }
  };

  const handleCreateTicket = async (e) => {
      e.preventDefault();
      if (submitting) return;

      setSubmitting(true);
      try {
          await api.post('/tickets', { 
              ...ticketForm, 
              account_id: user.account_id, 
              ticket_type: 'support' 
          });
          setShowModal(false);
          setTicketForm({ subject: '', description: '', priority: 'normal' });
          fetchPortal(); 
          addToast("Request sent successfully", "success");
      } catch (e) { 
          addToast("Failed to send request", "error");
      } finally {
          setSubmitting(false);
      }
  };

  const handleDownloadInvoice = async (invoiceId) => {
    setDownloadingInv(invoiceId);
    try {
      const response = await api.get(`/portal/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast("Invoice downloaded", "success");
    } catch (error) {
      console.error("Download failed", error);
      addToast("Failed to download invoice", "error");
    } finally {
      setDownloadingInv(null);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCategoryColor = (colorKey) => {
    const colors = {
      blue: 'border-blue-500/50 hover:border-blue-500',
      purple: 'border-purple-500/50 hover:border-purple-500',
      green: 'border-green-500/50 hover:border-green-500',
      yellow: 'border-yellow-500/50 hover:border-yellow-500',
      orange: 'border-orange-500/50 hover:border-orange-500',
      pink: 'border-pink-500/50 hover:border-pink-500'
    };
    return colors[colorKey] || 'border-slate-500/50';
  };

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  if (!data) return null;

  const { account, category_assessments = {}, open_tickets, invoices, projects, needs_questionnaire, lifecycle_stage } = data;
  
  // Check if ANY audits exist
  const hasAnyAudit = Object.keys(category_assessments).length > 0;
  
  // THEME
  const theme = usePortalTheme(account);

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => new Date(d).toLocaleDateString();

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
      
      {/* PORTAL NAVIGATION */}
      <nav className={`px-8 py-4 flex justify-between items-center ${theme.navBg}`}>
        <div>
            <h1 className={`text-xl font-bold ${theme.accent}`}>
                {theme.brandName}
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
        
        {/* ADMIN IMPERSONATION BANNER */}
        {impersonateId && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300">
            <span className="text-sm font-bold">👁 Viewing as: {account.name}</span>
            <button 
              onClick={() => window.close()} 
              className="text-xs px-3 py-1 rounded bg-cyan-500/30 hover:bg-cyan-500/50 font-bold"
            >
              Exit Preview
            </button>
          </div>
        )}

        {/* PHASE 61A: QUESTIONNAIRE BANNER (State-Based) */}
        <QuestionnaireBanner lifecycleStage={lifecycle_stage} />

        {/* PHASE 60A: HEALTH SCORES - 6 CATEGORY GRID */}
        {!hasAnyAudit && (
          <Card isNaked={theme.isNaked} dashed={true} className="text-center">
            <TrendingUp className="mx-auto mb-3 opacity-30" size={48} />
            <h3 className="text-lg font-bold mb-2">Unlock Your Health Scores</h3>
            <p className={`text-sm ${theme.textSub} mb-4`}>
              Complete your first assessment to see how your technology stack measures up across 6 key areas.
            </p>
            <button 
              onClick={() => portalNav('/portal/assessments')}
              className={`px-6 py-2 rounded-lg ${theme.btn} font-bold`}
            >
              Get Started
            </button>
          </Card>
        )}

        {hasAnyAudit && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest opacity-50">Health Scores</h2>
              <button
                onClick={() => portalNav('/portal/assessments')}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${theme.btn} flex items-center gap-2`}
              >
                <Plus size={16} />
                Request Assessment
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {CATEGORY_WIDGETS.map((widget) => (
                <HealthScoreWidget
                  key={widget.key}
                  category={widget.key}
                  label={widget.label}
                  icon={widget.icon}
                  color={widget.color}
                  assessments={category_assessments[widget.key] || []}
                  isNaked={theme.isNaked}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </div>
        )}

        {/* OPERATIONAL STATUS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* OPEN TICKETS COUNT + BUTTON */}
          <StatWidget
            icon={AlertCircle}
            label="Active Requests"
            count={open_tickets.length}
            actionButton={
              <button 
                onClick={() => setShowModal(true)} 
                className={`p-2 rounded-lg ${theme.btn} shadow-lg transition-transform hover:-translate-y-1`}
              >
                <Plus size={20} />
              </button>
            }
            isNaked={theme.isNaked}
          />

          {/* UNPAID INVOICES */}
          <StatWidget
            icon={Receipt}
            label="Open Invoices"
            count={invoices.filter(i => i.status === 'sent').length}
            isNaked={theme.isNaked}
          />

          {/* ASSETS CARD */}
          <StatWidget
            icon={Server}
            label="Asset Inventory"
            count="View All"
            onClick={() => portalNav('/portal/assets')}
            isNaked={theme.isNaked}
          />

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* TICKET STREAM */}
            <Card isNaked={theme.isNaked}>
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                    {open_tickets.length === 0 && <p className="text-sm opacity-50">No active tickets.</p>}
                    {open_tickets.slice(0, 5).map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => portalNav(`/portal/tickets/${t.id}`)}
                            className="p-3 rounded bg-black/5 dark:bg-white/5 flex justify-between items-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                            <div>
                                <div className="font-bold text-sm">{t.subject}</div>
                                <div className="text-xs opacity-50">#{t.id} • {formatDate(t.created_at)}</div>
                            </div>
                            <StatusBadge status={t.status} size="sm" />
                        </div>
                    ))}
                </div>
            </Card>

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
                                {inv.pdf_path && (
                                  <button 
                                    onClick={() => handleDownloadInvoice(inv.id)}
                                    disabled={downloadingInv === inv.id}
                                    className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-50 hover:opacity-100 disabled:opacity-20`}
                                  >
                                      {downloadingInv === inv.id ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                                  </button>
                                )}
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
                            <div 
                                key={p.id} 
                                onClick={() => portalNav(`/portal/projects/${p.id}`)}
                                className="p-4 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold">{p.name}</h4>
                                    <span className="text-xs opacity-50 uppercase">{p.status}</span>
                                </div>
                                <div className="text-xs opacity-50 mb-2">Due: {p.due_date || 'TBD'}</div>
                                
                                <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full ${theme.isNaked ? 'bg-naked-pink' : 'bg-sanctum-gold'}`} style={{ width: `${progress}%` }}></div>
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

      {/* CREATE TICKET MODAL */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`p-6 rounded-xl w-full max-w-md relative shadow-2xl ${theme.card} ${theme.isNaked ? 'text-slate-900' : 'text-white'}`}>
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4">How can we help?</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                    <Input 
                        label="Subject"
                        required 
                        className={`bg-black/10 border-slate-500/30 ${theme.isNaked ? 'text-slate-900' : 'text-white'}`}
                        value={ticketForm.subject} 
                        onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} 
                        placeholder="e.g. Need new email account" 
                    />
                    <Select 
                        label="Urgency"
                        className={`bg-black/10 border-slate-500/30 ${theme.isNaked ? 'text-slate-900' : 'text-white'}`}
                        value={ticketForm.priority} 
                        onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}
                    >
                        <option value="low">Low (General Query)</option>
                        <option value="normal">Normal (Standard Request)</option>
                        <option value="high">High (Urgent Issue)</option>
                        <option value="critical">Critical (System Down)</option>
                    </Select>
                    <div>
                        <label className="text-xs uppercase opacity-50 block mb-1">Details</label>
                        <textarea required className="w-full p-2 h-24 rounded bg-black/10 border border-slate-500/30 text-sm" value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} placeholder="Please describe the issue..." />
                    </div>
                    
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
