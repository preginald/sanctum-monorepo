import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Loader2, LogOut, Shield, AlertCircle, Receipt, Download, Briefcase, Plus, X, Server, ArrowRight, TrendingUp, Globe, Zap, RotateCcw, Star, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useToast } from '../context/ToastContext';

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
  const { user, logout } = useAuthStore();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({}); // Track which category widgets are expanded
  
  // TICKET MODAL STATE
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false); 
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [downloadingInv, setDownloadingInv] = useState(null);

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

  const { account, category_assessments = {}, open_tickets, invoices, projects } = data;
  
  // Check if ANY audits exist
  const hasAnyAudit = Object.keys(category_assessments).length > 0;
  
  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };
  
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
        
        {/* PHASE 60A: HEALTH SCORES - 6 CATEGORY GRID */}
        {!hasAnyAudit && (
          <div className={`p-6 rounded-xl border-2 border-dashed ${theme.card} text-center`}>
            <TrendingUp className="mx-auto mb-3 opacity-30" size={48} />
            <h3 className="text-lg font-bold mb-2">Unlock Your Health Scores</h3>
            <p className={`text-sm ${theme.textSub} mb-4`}>
              Complete your first assessment to see how your technology stack measures up across 6 key areas.
            </p>
            <button 
              onClick={() => navigate('/portal/assessments')}
              className={`px-6 py-2 rounded-lg ${theme.btn} font-bold`}
            >
              Get Started
            </button>
          </div>
        )}

        {hasAnyAudit && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest opacity-50">Health Scores</h2>
              <button
                onClick={() => navigate('/portal/assessments')}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${theme.btn} flex items-center gap-2`}
              >
                <Plus size={16} />
                Request Assessment
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {CATEGORY_WIDGETS.map(({ key, label, icon: Icon, color }) => {
                const assessments = category_assessments[key] || [];
                const hasAssessments = assessments.length > 0;
                const isExpanded = expandedCategories[key];
                
                // Primary assessment (first in array - highest priority by status)
                const primary = assessments[0];
                const additionalCount = assessments.length - 1;

                // Determine display content for primary assessment
                let primaryDisplay = null;
                let isClickable = false;
                
                if (!hasAssessments) {
                  // No assessments at all
                  primaryDisplay = <span className="text-2xl opacity-30">Not Assessed</span>;
                } else if (primary.status === 'draft') {
                  primaryDisplay = (
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-yellow-500">Assessment Requested</span>
                      <span className="text-xs opacity-50 mt-1">Our team will contact you soon</span>
                    </div>
                  );
                } else if (primary.status === 'in_progress') {
                  primaryDisplay = (
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-blue-500 flex items-center gap-2">
                        In Progress <Loader2 size={20} className="animate-spin" />
                      </span>
                      <span className="text-xs opacity-50 mt-1">Assessment underway</span>
                    </div>
                  );
                } else if (primary.status === 'finalized') {
                  primaryDisplay = (
                    <>
                      <span className={`text-5xl font-bold ${getScoreColor(primary.score)}`}>{primary.score}</span>
                      <span className="text-xl opacity-30 mb-1">/ 100</span>
                    </>
                  );
                  isClickable = true;
                }

                return (
                  <div
                    key={key}
                    className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between transition-all ${
                      hasAssessments ? '' : 'opacity-50'
                    }`}
                  >
                    {/* WIDGET HEADER */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                        <Icon size={16} /> {label}
                      </h3>
                      {assessments.length > 1 && (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-bold">
                          {assessments.length}
                        </span>
                      )}
                    </div>

                    {/* PRIMARY ASSESSMENT (Collapsed View) */}
                    {!isExpanded && (
                      <>
                        <div 
                          className={`flex items-end gap-2 mb-2 ${isClickable ? 'cursor-pointer' : ''}`}
                          onClick={() => isClickable && navigate(`/portal/audit/${key}`)}
                        >
                          {primaryDisplay}
                        </div>
                        
                        {hasAssessments && (
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="text-xs opacity-70 flex items-center gap-1">
                              {primary.status === 'finalized' && <CheckCircle size={14} className="text-green-500" />}
                              {primary.status === 'in_progress' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                              {primary.status === 'draft' && <span className="text-yellow-500">📝</span>}
                              {primary.template_name}
                            </div>
                            
                            {isClickable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/portal/audit/${key}`);
                                }}
                                className="text-xs text-blue-400 opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
                              >
                                View Report →
                              </button>
                            )}
                          </div>
                        )}
                        
                        {additionalCount > 0 && (
                          <button
                            onClick={() => toggleCategory(key)}
                            className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                          >
                            <ChevronDown size={14} />
                            + {additionalCount} more assessment{additionalCount > 1 ? 's' : ''}
                          </button>
                        )}
                      </>
                    )}

                    {/* EXPANDED VIEW - All Assessments */}
                    {isExpanded && (
                      <div className="space-y-3">
                        <button
                          onClick={() => toggleCategory(key)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-2 transition-colors"
                        >
                          <ChevronUp size={14} />
                          Collapse
                        </button>
                        
                        {assessments.map((assessment, idx) => {
                          const canView = assessment.status === 'finalized';
                          
                          return (
                            <div
                              key={assessment.id}
                              className="p-3 rounded-lg bg-white/5 border border-white/10"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="text-sm font-bold">{assessment.template_name}</div>
                                  <div className="text-xs opacity-50 mt-1">
                                    {assessment.status === 'draft' && '📝 Assessment Requested'}
                                    {assessment.status === 'in_progress' && (
                                      <span className="flex items-center gap-1">
                                        <Loader2 size={12} className="animate-spin" /> In Progress
                                      </span>
                                    )}
                                    {assessment.status === 'finalized' && (
                                      <span className={`flex items-center gap-1 ${getScoreColor(assessment.score)}`}>
                                        <CheckCircle size={12} /> Score: {assessment.score}/100
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {canView && (
                                  <button
                                    onClick={() => navigate(`/portal/audit/${key}`)}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                  >
                                    View <ArrowRight size={12} />
                                  </button>
                                )}
                              </div>
                              
                              {assessment.status === 'finalized' && (
                                <div className="mt-2">
                                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        assessment.score >= 80 ? 'bg-green-500' :
                                        assessment.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${assessment.score}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OPERATIONAL STATUS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* OPEN TICKETS COUNT + BUTTON */}
          <div className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between`}>
              <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                      <AlertCircle size={16} /> Active Requests
                  </h3>
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

          {/* ASSETS CARD */}
          <div 
              onClick={() => navigate('/portal/assets')}
              className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between cursor-pointer hover:border-cyan-500/50 transition-colors group`}
          >
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
                  <Server size={16} /> Asset Inventory
              </h3>
              <div className="mt-4 flex justify-between items-end">
                  <span className="text-xl font-bold opacity-80 group-hover:text-cyan-400 transition-colors">View All</span>
                  <ArrowRight size={24} className="opacity-50 group-hover:translate-x-1 group-hover:text-cyan-400 transition-all"/>
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
                        <div 
                            key={t.id} 
                            onClick={() => navigate(`/portal/tickets/${t.id}`)}
                            className="p-3 rounded bg-black/5 dark:bg-white/5 flex justify-between items-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
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
                                onClick={() => navigate(`/portal/projects/${p.id}`)}
                                className="p-4 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold">{p.name}</h4>
                                    <span className="text-xs opacity-50 uppercase">{p.status}</span>
                                </div>
                                <div className="text-xs opacity-50 mb-2">Due: {p.due_date || 'TBD'}</div>
                                
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

      {/* CREATE TICKET MODAL */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`p-6 rounded-xl w-full max-w-md relative shadow-2xl ${theme.card} ${isNaked ? 'text-slate-900' : 'text-white'}`}>
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4">How can we help?</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                    <Input 
                        label="Subject"
                        required 
                        className={`bg-black/10 border-slate-500/30 ${isNaked ? 'text-slate-900' : 'text-white'}`}
                        value={ticketForm.subject} 
                        onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} 
                        placeholder="e.g. Need new email account" 
                    />
                    <Select 
                        label="Urgency"
                        className={`bg-black/10 border-slate-500/30 ${isNaked ? 'text-slate-900' : 'text-white'}`}
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
