import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { ArrowLeft, Shield, Server, Globe, Zap, RotateCcw, Star, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import api from '../lib/api';

// Assessment data structure (will eventually come from API)
const ASSESSMENTS_BY_CATEGORY = {
  security: [
    {
      id: 'essential8',
      name: 'Essential 8 Maturity Model',
      framework: 'Essential8',
      tagline: 'Australian government cybersecurity baseline for threat mitigation',
      benefits: [
        'Protect against 85% of targeted cyber intrusions',
        'Meet government compliance requirements',
        'Reduce cyber insurance premiums',
        'Demonstrate security maturity to clients'
      ],
      whatWeAssess: [
        'Application control and whitelisting',
        'Patch management processes',
        'Multi-factor authentication coverage',
        'Privileged access management',
        'Backup and recovery procedures'
      ],
      risksOfInaction: [
        'Vulnerable to ransomware and malware attacks',
        'Non-compliance with ASD guidelines',
        'Higher breach remediation costs',
        'Reputational damage from security incidents'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'Initial consultation', duration: '1-2 business days' },
        { step: 'Assessment completion', duration: '3-5 business days' },
        { step: 'Report delivery', duration: '1 business day' }
      ]
    },
    {
      id: 'nist-csf',
      name: 'NIST Cybersecurity Framework',
      framework: 'NIST-CSF',
      tagline: 'Industry-standard security posture assessment',
      benefits: [
        'Align with international security standards',
        'Identify gaps across Identify, Protect, Detect, Respond, Recover',
        'Benchmark against industry peers',
        'Build board-level security reporting'
      ],
      whatWeAssess: [
        'Asset inventory and management',
        'Access control and identity management',
        'Security monitoring and detection',
        'Incident response capabilities',
        'Recovery planning and testing'
      ],
      risksOfInaction: [
        'Unknown security gaps and vulnerabilities',
        'Lack of measurable security metrics',
        'Difficulty demonstrating due diligence',
        'Inadequate incident response preparedness'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'Scoping call', duration: '1-2 business days' },
        { step: 'Assessment completion', duration: '5-7 business days' },
        { step: 'Report and recommendations', duration: '2 business days' }
      ]
    }
  ],
  infrastructure: [
    {
      id: 'infrastructure',
      name: 'Infrastructure Health Assessment',
      framework: 'INFRASTRUCTURE',
      tagline: 'Comprehensive evaluation of server, network, and capacity management',
      benefits: [
        'Prevent costly downtime and outages',
        'Optimize infrastructure spending',
        'Plan capacity before hitting limits',
        'Extend hardware lifecycle'
      ],
      whatWeAssess: [
        'Server and network uptime metrics',
        'Patch and firmware currency',
        'Backup integrity and recovery testing',
        'Storage and compute capacity trends',
        'Redundancy and failover configurations'
      ],
      risksOfInaction: [
        'Unexpected infrastructure failures',
        'Data loss from backup failures',
        'Performance degradation as capacity fills',
        'Higher emergency replacement costs'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'Remote assessment setup', duration: '1 business day' },
        { step: 'Data collection and analysis', duration: '3-5 business days' },
        { step: 'Report and roadmap delivery', duration: '1 business day' }
      ]
    }
  ],
  digital: [
    {
      id: 'digital',
      name: 'Digital Presence Assessment',
      framework: 'DIGITAL',
      tagline: 'Website performance, SEO, and domain health evaluation',
      benefits: [
        'Improve search engine rankings',
        'Faster page loads = higher conversions',
        'Avoid domain/SSL expiry incidents',
        'Enhance user experience metrics'
      ],
      whatWeAssess: [
        'Core Web Vitals and page speed',
        'SEO fundamentals and metadata',
        'SSL certificate validity',
        'Domain expiry and DNS configuration',
        'Broken links and technical SEO issues'
      ],
      risksOfInaction: [
        'Poor search visibility and lost traffic',
        'Slow website driving customers away',
        'Domain expiry causing business disruption',
        'Security warnings from expired SSL'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'Automated scan initiated', duration: '1 hour' },
        { step: 'Manual review and analysis', duration: '2-3 business days' },
        { step: 'Report with prioritized fixes', duration: '1 business day' }
      ]
    }
  ],
  efficiency: [
    {
      id: 'efficiency',
      name: 'Operational Efficiency Assessment',
      framework: 'EFFICIENCY',
      tagline: 'Software license optimization and SaaS cost analysis',
      benefits: [
        'Reclaim unused software licenses',
        'Eliminate redundant SaaS subscriptions',
        'Reduce annual software spend by 15-30%',
        'Optimize M365 license tiers'
      ],
      whatWeAssess: [
        'Software license inventory and utilization',
        'SaaS subscription overlap and redundancy',
        'Cloud spending trends and anomalies',
        'M365 feature usage vs license tier',
        'Opportunities for automation'
      ],
      risksOfInaction: [
        'Paying for unused licenses and seats',
        'Shadow IT and compliance risks',
        'Inefficient processes consuming staff time',
        'Vendor price increases without negotiation'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'License data export', duration: '1-2 business days' },
        { step: 'Usage analysis', duration: '3-5 business days' },
        { step: 'Savings recommendations', duration: '1 business day' }
      ]
    }
  ],
  continuity: [
    {
      id: 'continuity',
      name: 'Business Continuity Assessment',
      framework: 'CONTINUITY',
      tagline: 'Disaster recovery readiness and operational resilience evaluation',
      benefits: [
        'Minimize revenue loss during incidents',
        'Meet RTO/RPO requirements',
        'Satisfy insurance and compliance needs',
        'Reduce recovery time by 50%+'
      ],
      whatWeAssess: [
        'Disaster recovery plan completeness',
        'RTO and RPO definitions and testing',
        'Backup restoration procedures',
        'Incident response runbooks',
        'Alternative workspace arrangements'
      ],
      risksOfInaction: [
        'Extended downtime after disasters',
        'Data loss exceeding RPO targets',
        'Unprepared staff during crises',
        'Insurance claims denied for lack of DR plan'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'DR plan review', duration: '2-3 business days' },
        { step: 'Tabletop exercise (optional)', duration: '1 business day' },
        { step: 'Gap analysis and recommendations', duration: '2 business days' }
      ]
    }
  ],
  ux: [
    {
      id: 'ux',
      name: 'User Experience & Support Assessment',
      framework: 'UX',
      tagline: 'Help desk performance and user satisfaction measurement',
      benefits: [
        'Improve support ticket resolution times',
        'Increase user satisfaction scores',
        'Reduce repeat tickets through better documentation',
        'Identify training gaps'
      ],
      whatWeAssess: [
        'Ticket SLA compliance rates',
        'Customer satisfaction survey results',
        'Knowledge base coverage and usage',
        'Training completion metrics',
        'Portal adoption and engagement'
      ],
      risksOfInaction: [
        'Frustrated users and low productivity',
        'High repeat ticket volumes',
        'Knowledge loss when staff leave',
        'Poor user adoption of new tools'
      ],
      timeline: [
        { step: 'Request submitted', duration: 'Immediate' },
        { step: 'Support data export', duration: '1 business day' },
        { step: 'User survey (optional)', duration: '3-5 business days' },
        { step: 'Report and improvement plan', duration: '2 business days' }
      ]
    }
  ]
};

const CATEGORY_CONFIG = {
  security: { label: 'Security & Compliance', icon: Shield, color: 'blue' },
  infrastructure: { label: 'Infrastructure Health', icon: Server, color: 'purple' },
  digital: { label: 'Digital Presence', icon: Globe, color: 'green' },
  efficiency: { label: 'Operational Efficiency', icon: Zap, color: 'yellow' },
  continuity: { label: 'Business Continuity', icon: RotateCcw, color: 'orange' },
  ux: { label: 'User Experience & Support', icon: Star, color: 'pink' }
};

export default function PortalAssessments() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [account, setAccount] = useState(null);
  const [templates, setTemplates] = useState([]); // Available audit templates
  const [existingAssessments, setExistingAssessments] = useState({}); // {framework: {status, id}}
  const [expandedCards, setExpandedCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(null); // Track which assessment is being requested

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, templatesRes] = await Promise.all([
        api.get('/portal/dashboard'),
        api.get('/sentinel/templates')
      ]);
      setAccount(dashRes.data.account);
      setTemplates(templatesRes.data);
      
      // Build map of existing assessments by framework
      const assessmentMap = {};
      const categoryAssessments = dashRes.data.category_assessments || {};
      
      Object.values(categoryAssessments).forEach(assessments => {
        assessments.forEach(assessment => {
          // Use framework directly from assessment data
          if (assessment.framework) {
            assessmentMap[assessment.framework] = {
              status: assessment.status,
              id: assessment.id,
              template_name: assessment.template_name
            };
          }
        });
      });
      
      setExistingAssessments(assessmentMap);
    } catch (e) {
      console.error(e);
      if (e.response?.status === 403) logout();
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (assessmentId) => {
    setExpandedCards(prev => ({
      ...prev,
      [assessmentId]: !prev[assessmentId]
    }));
  };

  const handleRequestAssessment = async (assessment) => {
    // Find template by framework code
    const template = templates.find(t => t.framework === assessment.framework);
    
    if (!template) {
      alert(`Template not found for ${assessment.name}. Please contact support.`);
      return;
    }
    
    if (requesting) return; // Prevent double-clicks
    
    if (!confirm(`Request ${assessment.name}?\n\nOur team will contact you within 1-2 business days to schedule the assessment.`)) {
      return;
    }
    
    setRequesting(assessment.id);
    
    try {
      const res = await api.post('/portal/assessments/request', {
        template_id: template.id
      });
      
      // Success - navigate back to dashboard
      alert(`✓ Assessment Requested!\n\n${res.data.message}\n\nYou'll receive an email confirmation shortly.`);
      navigate('/portal/dashboard');
      
    } catch (e) {
      console.error('Assessment request failed:', e);
      if (e.response?.data?.detail) {
        alert(`Request failed: ${e.response.data.detail}`);
      } else {
        alert('Failed to submit request. Please try again or contact support.');
      }
    } finally {
      setRequesting(null);
    }
  };

  // Dynamic branding
  const isNaked = account?.brand_affinity === 'nt';
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-slate-900',
    card: isNaked ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800 border-slate-700',
    textMain: isNaked ? 'text-slate-900' : 'text-white',
    textSub: isNaked ? 'text-slate-500' : 'text-slate-400',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    navBg: isNaked ? 'bg-white border-b border-slate-200' : 'bg-slate-900 border-b border-slate-800',
    btn: isNaked ? 'bg-naked-pink hover:bg-pink-600 text-white' : 'bg-sanctum-gold hover:bg-yellow-500 text-slate-900'
  };

  if (loading) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${theme.bg} ${theme.textMain}`}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
      
      {/* NAVIGATION */}
      <nav className={`px-8 py-4 flex justify-between items-center ${theme.navBg}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/portal/dashboard')}
            className="p-2 rounded hover:bg-white/10 opacity-70"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${theme.accent}`}>
              {isNaked ? 'Naked Tech' : 'SANCTUM'}
            </h1>
            <p className="text-xs uppercase tracking-widest opacity-50">
              Available Assessments
            </p>
          </div>
        </div>
        <span className="text-sm opacity-70">{account?.name}</span>
      </nav>

      <main className="p-8 max-w-6xl mx-auto space-y-8">
        
        {/* INTRO */}
        <div className={`p-6 rounded-xl border ${theme.card}`}>
          <h2 className="text-2xl font-bold mb-2">Health Assessments</h2>
          <p className={theme.textSub}>
            Request a comprehensive assessment across any of the following areas. Our team will complete the evaluation and provide you with actionable recommendations.
          </p>
        </div>

        {/* CATEGORY SECTIONS */}
        {Object.entries(CATEGORY_CONFIG).map(([categoryKey, { label, icon: Icon, color }]) => {
          const assessments = ASSESSMENTS_BY_CATEGORY[categoryKey] || [];
          
          return (
            <div key={categoryKey} className="space-y-4">
              
              {/* CATEGORY HEADER */}
              <div className="flex items-center gap-3">
                <Icon size={24} className="opacity-50" />
                <h3 className="text-lg font-bold uppercase tracking-wide opacity-70">
                  {label}
                </h3>
              </div>

              {/* ASSESSMENT CARDS */}
              <div className="space-y-3">
                {assessments.map((assessment) => {
                  const isExpanded = expandedCards[assessment.id];
                  const existing = existingAssessments[assessment.framework];
                  const alreadyRequested = existing && (existing.status === 'draft' || existing.status === 'in_progress');
                  const canRequest = !alreadyRequested && requesting !== assessment.id;
                  
                  let buttonText = 'Request Assessment';
                  let buttonClass = theme.btn;
                  
                  if (alreadyRequested) {
                    if (existing.status === 'draft') {
                      buttonText = '✓ Already Requested';
                      buttonClass = 'bg-yellow-500/20 text-yellow-500 cursor-not-allowed';
                    } else if (existing.status === 'in_progress') {
                      buttonText = '⏳ In Progress';
                      buttonClass = 'bg-blue-500/20 text-blue-500 cursor-not-allowed';
                    }
                  } else if (requesting === assessment.id) {
                    buttonText = 'Requesting...';
                    buttonClass = `${theme.btn} opacity-50 cursor-not-allowed`;
                  }
                  
                  return (
                    <div
                      key={assessment.id}
                      className={`rounded-xl border ${theme.card} overflow-hidden transition-all`}
                    >
                      
                      {/* CARD HEADER (Always Visible) */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <button
                            onClick={() => toggleCard(assessment.id)}
                            className="flex-1 text-left"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                              <h4 className="font-bold text-lg">{assessment.name}</h4>
                            </div>
                            <p className={`text-sm ${theme.textSub} ml-7`}>
                              {assessment.tagline}
                            </p>
                          </button>
                          
                          <button
                            onClick={() => canRequest && handleRequestAssessment(assessment)}
                            disabled={!canRequest}
                            className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-2 ${buttonClass}`}
                          >
                            {requesting === assessment.id && <Loader2 size={16} className="animate-spin" />}
                            {buttonText}
                          </button>
                        </div>
                        
                        {alreadyRequested && (
                          <div className="mt-2 ml-7 text-xs text-blue-400">
                            View progress on your dashboard →
                          </div>
                        )}
                      </div>

                      {/* EXPANDED CONTENT */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 p-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* BENEFITS */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="text-green-500" size={20} />
                                <h5 className="font-bold uppercase text-sm tracking-wide">Benefits</h5>
                              </div>
                              <ul className="space-y-2 ml-7">
                                {assessment.benefits.map((benefit, idx) => (
                                  <li key={idx} className={`text-sm ${theme.textSub}`}>
                                    • {benefit}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* WHAT WE ASSESS */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="text-blue-500" size={20} />
                                <h5 className="font-bold uppercase text-sm tracking-wide">What We'll Assess</h5>
                              </div>
                              <ul className="space-y-2 ml-7">
                                {assessment.whatWeAssess.map((item, idx) => (
                                  <li key={idx} className={`text-sm ${theme.textSub}`}>
                                    • {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* RISKS OF INACTION */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="text-red-500" size={20} />
                                <h5 className="font-bold uppercase text-sm tracking-wide">Risks of Inaction</h5>
                              </div>
                              <ul className="space-y-2 ml-7">
                                {assessment.risksOfInaction.map((risk, idx) => (
                                  <li key={idx} className={`text-sm ${theme.textSub}`}>
                                    • {risk}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* TIMELINE */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Clock className="text-yellow-500" size={20} />
                                <h5 className="font-bold uppercase text-sm tracking-wide">What Happens Next</h5>
                              </div>
                              <div className="ml-7 space-y-2">
                                {assessment.timeline.map((step, idx) => (
                                  <div key={idx} className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-green-500' : 'bg-slate-500'}`} />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium">{step.step}</span>
                                      <span className={`text-xs ml-2 ${theme.textSub}`}>({step.duration})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}

      </main>
    </div>
  );
}
