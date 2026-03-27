import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, Save, Shield, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, MinusCircle, Play, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AuditDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [audit, setAudit] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [responses, setResponses] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    if (id && id !== 'new') {
      fetchAudit();
    } else {
      initNewAudit();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, accountId]);

  // Poll scan status while running
  useEffect(() => {
    if (audit?.scan_status === 'running' && id && id !== 'new') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/sentinel/status/${id}`);
          if (res.data.scan_status !== 'running') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setScanning(false);
            fetchAudit(); // Refresh full audit data
          }
        } catch (e) {
          console.error('Poll failed:', e);
        }
      }, 3000);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [audit?.scan_status, id]);

  const initNewAudit = async () => {
    setAudit({ account_id: accountId, status: 'draft', security_score: 0 });
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/sentinel/templates');
      setTemplates(res.data);
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sentinel/audits/${id}`);
      setAudit(res.data);

      // Wait for templates to load if they haven't yet
      let templatesList = templates;
      if (templates.length === 0) {
        const templatesRes = await api.get('/sentinel/templates');
        templatesList = templatesRes.data;
        setTemplates(templatesRes.data);
      }

      if (res.data.template_id) {
        const template = templatesList.find(t => t.id === res.data.template_id);
        if (template) {
          // Use the category_structure from the audit response (it's already hydrated)
          setSelectedTemplate({
            ...template,
            category_structure: res.data.category_structure
          });
        }
      }

      if (res.data.responses) {
        setResponses(res.data.responses);
      }

      // Auto-expand first category
      if (res.data.category_structure && res.data.category_structure.length > 0) {
        setExpandedCategories({ [res.data.category_structure[0].category]: true });
      }

      // If scan is running, set scanning state
      if (res.data.scan_status === 'running') {
        setScanning(true);
      }

    } catch (e) {
      console.error(e);
      addToast('Failed to load audit', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template);
    setResponses({}); // Clear responses when changing template

    // Auto-expand first category
    if (template?.category_structure?.length > 0) {
      setExpandedCategories({ [template.category_structure[0].category]: true });
    }
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const updateResponse = (controlId, field, value) => {
    setResponses(prev => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        [field]: value
      }
    }));
  };

  const calculateScore = () => {
    if (!selectedTemplate || !selectedTemplate.category_structure) return 0;

    let totalWeight = 0;
    let earnedWeight = 0;

    selectedTemplate.category_structure.forEach(category => {
      if (!category.controls) return;

      category.controls.forEach(control => {
        const weight = control.weight || 1;
        const response = responses[control.id];
        const status = response?.status || 'fail';

        if (status !== 'na') {
          totalWeight += weight;

          if (status === 'pass') {
            earnedWeight += weight;
          } else if (status === 'partial') {
            earnedWeight += weight * 0.5;
          }
        }
      });
    });

    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  };

  const saveAudit = async () => {
    if (!selectedTemplate) {
      addToast('Please select a template first', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        template_id: selectedTemplate.id,
        responses: responses
      };

      if (id && id !== 'new') {
        await api.post(`/sentinel/audits/${id}/submit`, payload);
        addToast('Audit saved successfully', 'success');
        fetchAudit();
      } else {
        // Create new audit first
        const createRes = await api.post('/audits', {
          account_id: accountId,
          template_id: selectedTemplate.id,
          status: 'draft'
        });

        // Then submit responses
        await api.post(`/sentinel/audits/${createRes.data.id}/submit`, payload);
        addToast('Audit created successfully', 'success');
        navigate(`/audit/${createRes.data.id}`);
      }
    } catch (e) {
      console.error(e);
      addToast('Failed to save audit', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const runScan = async () => {
    if (!selectedTemplate) {
      addToast('Please select a template first', 'warning');
      return;
    }

    setScanning(true);
    try {
      let auditId = id;

      // If new audit, create it first
      if (!id || id === 'new') {
        const createRes = await api.post('/audits', {
          account_id: accountId,
          template_id: selectedTemplate.id,
          status: 'draft'
        });
        auditId = createRes.data.id;
        navigate(`/audit/${auditId}`, { replace: true });
      }

      const res = await api.post(`/sentinel/audits/${auditId}/scan`);
      setAudit(prev => ({ ...prev, scan_status: 'running' }));
      addToast('Scan initiated', 'success');
    } catch (e) {
      console.error(e);
      const msg = e.response?.data?.detail || 'Failed to start scan';
      addToast(msg, 'danger');
      setScanning(false);
    }
  };

  const isAutomated = selectedTemplate?.scan_mode === 'automated';

  const auditStatusColor = (s) => {
    const map = { draft: 'bg-yellow-500/20 text-yellow-400', finalized: 'bg-green-500/20 text-green-400', 'in_progress': 'bg-blue-500/20 text-blue-400' };
    return map[s] || 'bg-white/10 text-slate-300';
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

  const getScanStatusBadge = () => {
    const status = audit?.scan_status;
    if (!status || status === 'idle') return null;
    const map = {
      running: { bg: 'bg-blue-500/20 text-blue-400', label: 'Scanning...' },
      completed: { bg: 'bg-green-500/20 text-green-400', label: 'Completed' },
      failed: { bg: 'bg-red-500/20 text-red-400', label: 'Failed' },
    };
    const style = map[status] || { bg: 'bg-white/10 text-slate-300', label: status };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase ${style.bg}`}>
        {status === 'running' && <Loader2 className="animate-spin" size={12} />}
        {style.label}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout title="Loading...">
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-sanctum-gold" size={48} />
        </div>
      </Layout>
    );
  }

  const currentScore = isAutomated ? (audit?.security_score || 0) : calculateScore();
  const categoryStructure = audit?.category_structure || selectedTemplate?.category_structure || [];

  return (
    <Layout
      title={isAutomated ? 'Website Health Scan' : audit?.status === 'finalized' ? 'Compliance Audit' : id && id !== 'new' ? 'Draft Assessment' : 'New Assessment'}
      breadcrumb={[
        { label: audit?.account_name, path: audit?.account_id ? `/clients/${audit.account_id}` : '/clients' },
        { label: 'Audits', path: '/audits' },
      ]}
      badges={audit?.status ? [{ value: audit.status, map: 'auditStatus' }] : []}
      onRefresh={fetchAudit}
      onCopyMeta={() => `${audit?.account_name || "New"} — ${selectedTemplate?.name || "No template"}\nStatus: ${audit?.status || "draft"}\nScore: ${currentScore}/100`}
      actions={
        <div className="flex items-center gap-4">
          {selectedTemplate && (
            <div className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg flex items-center gap-3">
              <span className="text-xs text-slate-400 uppercase font-bold">Score</span>
              <span className={`text-2xl font-bold ${getScoreColor(currentScore)}`}>
                {currentScore}<span className="text-sm">/100</span>
              </span>
            </div>
          )}
          {isAutomated ? (
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 hover:bg-yellow-500 rounded font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {scanning ? <Loader2 className="animate-spin" size={16} /> : audit?.scan_status === 'failed' ? <RefreshCw size={16} /> : <Play size={16} />}
              {scanning ? 'Scanning...' : audit?.scan_status === 'failed' ? 'Retry Scan' : 'Run Scan'}
            </button>
          ) : (
            audit?.status !== 'finalized' && (
              <button onClick={saveAudit} disabled={saving || !selectedTemplate} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 hover:bg-yellow-500 rounded font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Assessment
              </button>
            )
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* SIDEBAR: TEMPLATE SELECTOR */}
        <div className="space-y-6">

          {/* TEMPLATE PICKER */}
          {audit?.status !== 'finalized' && (
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="font-bold text-sm uppercase text-slate-400 mb-4">Audit Framework</h3>
              <select
                className="w-full bg-black/40 border border-slate-600 rounded-lg px-4 h-10 text-sm text-white focus:border-blue-500 focus:outline-none"
                value={selectedTemplate?.id || ''}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">Select Template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="mt-3 text-xs text-slate-400">
                  {selectedTemplate.description}
                </p>
              )}
            </div>
          )}

          {/* SCAN STATUS (automated only) */}
          {isAutomated && audit?.scan_status && audit.scan_status !== 'idle' && (
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="font-bold text-sm uppercase text-slate-400 mb-4">Scan Status</h3>
              <div className="space-y-3">
                {getScanStatusBadge()}
                {audit.scan_status === 'failed' && audit.content?.scan_error && (
                  <p className="text-xs text-red-400 mt-2">
                    {audit.content.scan_error}
                  </p>
                )}
                {audit.scan_status === 'completed' && audit.content?.report_url && (
                  <a
                    href={audit.content.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline block mt-2"
                  >
                    View Full Report
                  </a>
                )}
              </div>
            </div>
          )}

          {/* STATS (manual templates only) */}
          {selectedTemplate && !isAutomated && (
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="font-bold text-sm uppercase text-slate-400 mb-4">Compliance Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="text-green-500" size={14} />
                    Pass
                  </span>
                  <span className="font-mono">
                    {Object.values(responses).filter(r => r.status === 'pass').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <MinusCircle className="text-yellow-500" size={14} />
                    Partial
                  </span>
                  <span className="font-mono">
                    {Object.values(responses).filter(r => r.status === 'partial').length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="text-red-500" size={14} />
                    Fail
                  </span>
                  <span className="font-mono">
                    {Object.values(responses).filter(r => r.status === 'fail').length}
                  </span>
                </div>
                <div className="flex justify-between items-center opacity-50">
                  <span className="flex items-center gap-2">
                    <MinusCircle className="text-slate-500" size={14} />
                    N/A
                  </span>
                  <span className="font-mono">
                    {Object.values(responses).filter(r => r.status === 'na').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-3">
          {!selectedTemplate ? (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-12 text-center">
              <Shield className="mx-auto mb-4 text-slate-600" size={64} />
              <p className="text-slate-400">
                Select an audit framework to begin the assessment
              </p>
            </div>
          ) : isAutomated ? (
            /* AUTOMATED SCAN VIEW */
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
              <div className="text-center space-y-6">
                <Shield className="mx-auto text-sanctum-gold" size={64} />
                <div>
                  <h2 className="text-xl font-bold mb-2">Website Health Scan</h2>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    Automated scan powered by Sanctum Audit API. Scores across SEO, security, performance, accessibility, and more.
                  </p>
                </div>

                {!audit?.scan_status || audit.scan_status === 'idle' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                      Click "Run Scan" to start the automated website health analysis.
                    </p>
                  </div>
                ) : audit.scan_status === 'running' ? (
                  <div className="space-y-4">
                    <Loader2 className="animate-spin mx-auto text-blue-400" size={32} />
                    <p className="text-sm text-blue-400">
                      Scan in progress... This may take up to 2 minutes.
                    </p>
                  </div>
                ) : audit.scan_status === 'completed' ? (
                  <div className="space-y-4">
                    <div className={`text-6xl font-bold ${getScoreColor(audit.security_score)}`}>
                      {audit.security_score}<span className="text-2xl">/100</span>
                    </div>
                    <p className="text-sm text-green-400">Scan completed successfully</p>
                    {audit.content?.report_url && (
                      <a
                        href={audit.content.report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm font-bold"
                      >
                        View Detailed Report
                      </a>
                    )}
                  </div>
                ) : audit.scan_status === 'failed' ? (
                  <div className="space-y-4">
                    <AlertCircle className="mx-auto text-red-400" size={32} />
                    <p className="text-sm text-red-400">
                      Scan failed. {audit.content?.scan_error || 'Unknown error.'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Click "Retry Scan" to try again.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            /* MANUAL QUESTIONNAIRE VIEW */
            <div className="space-y-4">
              {categoryStructure.map((category, catIdx) => {
                const isExpanded = expandedCategories[category.category];

                return (
                  <div key={catIdx} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">

                    {/* CATEGORY HEADER */}
                    <button
                      onClick={() => toggleCategory(category.category)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        <h3 className="font-bold text-sm uppercase tracking-wide">
                          {category.category}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">
                        {category.controls.length} controls
                      </span>
                    </button>

                    {/* CONTROLS */}
                    {isExpanded && (
                      <div className="border-t border-slate-800">
                        {category.controls.map((control, ctrlIdx) => {
                          const response = responses[control.id] || {};
                          const status = response.status || '';

                          return (
                            <div
                              key={control.id}
                              className="p-4 border-b border-slate-800 last:border-b-0 hover:bg-white/5 transition-colors"
                            >

                              {/* CONTROL HEADER */}
                              <div className="flex items-start gap-3 mb-3">
                                {getStatusIcon(status)}
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{control.name}</p>
                                  {control.weight > 1 && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                      Weight: {control.weight}x
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* STATUS SELECTOR */}
                              {audit?.status !== 'finalized' && (
                                <div className="ml-7 space-y-3">
                                  <div className="flex gap-3">
                                    {['pass', 'partial', 'fail', 'na'].map(s => (
                                      <label
                                        key={s}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                          status === s
                                            ? 'bg-blue-500/20 border border-blue-500'
                                            : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                                        }`}
                                      >
                                        <input
                                          type="radio"
                                          name={`control-${control.id}`}
                                          value={s}
                                          checked={status === s}
                                          onChange={() => updateResponse(control.id, 'status', s)}
                                          className="accent-blue-500"
                                        />
                                        <span className="text-xs font-bold uppercase">
                                          {s === 'na' ? 'N/A' : s}
                                        </span>
                                      </label>
                                    ))}
                                  </div>

                                  {/* NOTES FIELD */}
                                  <textarea
                                    placeholder="Add notes or evidence..."
                                    className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:border-blue-500 focus:outline-none resize-none"
                                    rows={2}
                                    value={response.notes || ''}
                                    onChange={(e) => updateResponse(control.id, 'notes', e.target.value)}
                                  />
                                </div>
                              )}

                              {/* READ-ONLY VIEW FOR FINALIZED */}
                              {audit?.status === 'finalized' && (
                                <div className="ml-7 text-sm text-slate-400">
                                  {response.notes || 'No notes'}
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
          )}
        </div>

      </div>
    </Layout>
  );
}
