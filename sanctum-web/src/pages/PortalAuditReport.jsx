import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import usePortalNav from '../hooks/usePortalNav';
import useAuthStore from '../store/authStore';
import { Loader2, ArrowLeft, Shield, CheckCircle2, AlertCircle, MinusCircle, ChevronDown, ChevronRight, Server, Globe, Zap, RotateCcw, Star } from 'lucide-react';
import api from '../lib/api';

// PHASE 60A: Category Icon Mapping
const CATEGORY_ICONS = {
  security: Shield,
  infrastructure: Server,
  digital: Globe,
  efficiency: Zap,
  continuity: RotateCcw,
  ux: Star
};

const CATEGORY_LABELS = {
  security: 'Security',
  infrastructure: 'Infrastructure Health',
  digital: 'Digital Presence',
  efficiency: 'Operational Efficiency',
  continuity: 'Business Continuity',
  ux: 'User Experience'
};

export default function PortalAuditReport() {
  const navigate = useNavigate();
  const { portalNav, impersonateId } = usePortalNav();
  const { category } = useParams(); // PHASE 60A: Category from URL
  const { user, logout } = useAuthStore();
  const [audit, setAudit] = useState(null);
  const [generatingDeal, setGeneratingDeal] = useState(false);
  const [account, setAccount] = useState(null);
  const [auditId, setAuditId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);

  const handleRequestRemediation = async () => {
    if (generatingDeal) return;
    if (!confirm('Generate a remediation quote for all failed controls?')) return;
    
    setGeneratingDeal(true);
    try {
      const res = await api.post(`/sentinel/audits/${auditId}/generate-deal`);
      
      // Refresh audit data to get the new deal_id
      const auditRes = await api.get(`/sentinel/audits/${auditId}`);
      setAudit(auditRes.data);
      
      alert(`Remediation quote created! Total: $${res.data.deal_amount.toLocaleString()}\n\nOur team will review and contact you shortly.`);
    } catch (e) {
      if (e.response?.data?.detail) {
        alert(e.response.data.detail);
      } else {
        alert('Failed to generate quote. Please contact support.');
      }
    } finally {
      setGeneratingDeal(false);
    }
  };

  useEffect(() => {
    fetchAuditReport();
  }, [category]);

  const fetchAuditReport = async () => {
    try {
      // Get dashboard data to find category-specific assessments
      const dashRes = await api.get(`/portal/dashboard${impersonateId ? '?impersonate=' + impersonateId : ''}`);
      setAccount(dashRes.data.account);
      
      const categoryAssessments = dashRes.data.category_assessments || {};
      const assessments = categoryAssessments[category] || [];
      
      if (assessments.length === 0) {
        console.log(`No assessments found for category: ${category}`);
        setLoading(false);
        return;
      }
      
      // Get primary assessment (first in array - highest priority)
      const primaryAssessment = assessments[0];
      setAuditId(primaryAssessment.id);

      // Fetch full audit details
      const auditRes = await api.get(`/sentinel/audits/${primaryAssessment.id}`);
      setAudit(auditRes.data);
      
      // Auto-expand first category
      if (auditRes.data.category_structure?.length > 0) {
        setExpandedCategories({ [auditRes.data.category_structure[0].category]: true });
      }
      
    } catch (e) {
      console.error('Error fetching audit report:', e);
      if (e.response?.status === 403) logout();
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'fail': return <AlertCircle className="text-red-500" size={16} />;
      case 'partial': return <MinusCircle className="text-yellow-500" size={16} />;
      case 'na': return <MinusCircle className="text-slate-500" size={16} />;
      default: return <AlertCircle className="text-slate-600" size={16} />;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Calculate stats
  const responses = audit?.responses || {};
  const passCount = Object.values(responses).filter(r => r.status === 'pass').length;
  const partialCount = Object.values(responses).filter(r => r.status === 'partial').length;
  const failCount = Object.values(responses).filter(r => r.status === 'fail').length;
  const naCount = Object.values(responses).filter(r => r.status === 'na').length;

  // Get category icon and label
  const CategoryIcon = CATEGORY_ICONS[category] || Shield;
  const categoryLabel = CATEGORY_LABELS[category] || 'Assessment';

  // Dynamic branding
  const isNaked = account?.brand_affinity === 'nt';
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    navBg: isNaked ? 'bg-white border-b border-slate-200' : 'bg-slate-900 border-b border-slate-800',
  };

  if (loading) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${theme.bg} ${theme.textMain}`}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
        <nav className={`px-8 py-4 flex justify-between items-center ${theme.navBg}`}>
          <div>
            <h1 className={`text-xl font-bold ${theme.accent}`}>
              {isNaked ? 'Naked Tech' : 'SANCTUM'}
            </h1>
            <p className="text-xs uppercase tracking-widest opacity-50">{categoryLabel} Report</p>
          </div>
        </nav>
        <main className="p-8 max-w-4xl mx-auto">
          <div className={`p-12 rounded-xl border ${theme.card} text-center`}>
            <CategoryIcon className="mx-auto mb-4 opacity-30" size={64} />
            <h2 className="text-xl font-bold mb-2">No {categoryLabel} Assessment Available</h2>
            <p className={theme.textSub}>
              Your {categoryLabel.toLowerCase()} audit is currently being prepared. Check back soon.
            </p>
            <button
              onClick={() => portalNav('/portal')}
              className="mt-6 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
      
      {/* NAVIGATION */}
      <nav className={`px-8 py-4 flex justify-between items-center ${theme.navBg}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => portalNav('/portal')}
            className="p-2 rounded hover:bg-white/10 opacity-70"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${theme.accent}`}>
              {isNaked ? 'Naked Tech' : 'SANCTUM'}
            </h1>
            <p className="text-xs uppercase tracking-widest opacity-50">
              {categoryLabel} Report
            </p>
          </div>
        </div>
        <span className="text-sm opacity-70">{account?.name}</span>
      </nav>

      <main className="p-8 max-w-6xl mx-auto space-y-8">
        
        {/* HEADER SECTION */}
        <div className={`p-8 rounded-xl border ${theme.card}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <CategoryIcon size={36} className="opacity-70" />
                {categoryLabel} Assessment
              </h2>
              <p className={`text-sm ${theme.textSub}`}>
                Framework: {audit.template_name}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-6xl font-bold ${getScoreColor(audit.security_score)}`}>
                  {audit.security_score}
                </div>
                <div className="text-sm opacity-50 mt-1">/ 100</div>
              </div>
              {failCount > 0 && (
                audit.deal_id ? (
                  <button
                    onClick={() => alert(`Remediation quote has been generated!\n\nDeal ID: ${audit.deal_id}\n\nOur team will review the quote and contact you shortly with next steps.`)}
                    className={`px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg hover:scale-105 ${
                      isNaked 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    ✓ Quote Requested
                  </button>
                ) : (
                  <button
                    onClick={handleRequestRemediation}
                    disabled={generatingDeal}
                    className={`px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg ${
                      generatingDeal ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                    } ${
                      isNaked 
                        ? 'bg-naked-pink hover:bg-pink-600 text-white' 
                        : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900'
                    }`}
                  >
                    {generatingDeal ? 'Generating Quote...' : 'Request Remediation Quote'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="text-green-500" size={20} />
              <span className="text-sm font-bold uppercase opacity-70">Pass</span>
            </div>
            <div className="text-3xl font-bold">{passCount}</div>
          </div>
          
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex items-center gap-2 mb-2">
              <MinusCircle className="text-yellow-500" size={20} />
              <span className="text-sm font-bold uppercase opacity-70">Partial</span>
            </div>
            <div className="text-3xl font-bold">{partialCount}</div>
          </div>
          
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="text-red-500" size={20} />
              <span className="text-sm font-bold uppercase opacity-70">Fail</span>
            </div>
            <div className="text-3xl font-bold">{failCount}</div>
          </div>
          
          <div className={`p-4 rounded-xl border ${theme.card}`}>
            <div className="flex items-center gap-2 mb-2">
              <MinusCircle className="text-slate-500" size={20} />
              <span className="text-sm font-bold uppercase opacity-70">N/A</span>
            </div>
            <div className="text-3xl font-bold">{naCount}</div>
          </div>
        </div>

        {/* COMPLIANCE BREAKDOWN */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold uppercase tracking-wide opacity-70">
            Detailed Assessment
          </h3>
          
          {audit.category_structure?.map((category, catIdx) => {
            const isExpanded = expandedCategories[category.category];
            
            return (
              <div key={catIdx} className={`rounded-xl border ${theme.card} overflow-hidden`}>
                
                {/* CATEGORY HEADER */}
                <button
                  onClick={() => toggleCategory(category.category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h4 className="font-bold text-sm uppercase tracking-wide">
                      {category.category}
                    </h4>
                  </div>
                  <span className="text-xs opacity-50">
                    {category.controls.length} controls
                  </span>
                </button>

                {/* CONTROLS */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50">
                    {category.controls.map((control) => {
                      const response = responses[control.id] || {};
                      const status = response.status || 'fail';
                      
                      return (
                        <div
                          key={control.id}
                          className="p-4 border-b border-slate-700/30 last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            {getStatusIcon(status)}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{control.name}</p>
                              {response.notes && (
                                <p className={`text-xs mt-2 ${theme.textSub}`}>
                                  {response.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </main>
    </div>
  );
}
