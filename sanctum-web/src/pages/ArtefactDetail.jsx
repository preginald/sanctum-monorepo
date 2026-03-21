import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import {
  Loader2, FileText, Link2, Code, Key, File, Ticket, BookOpen, Building2,
  FolderOpen, Flag, History, Edit2, Save, X, RotateCcw, ChevronDown, ChevronUp,
  Shield, Tag, AlertTriangle, Archive
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import MetadataStrip from '../components/ui/MetadataStrip';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';

const typeIcon = (type) => {
  const map = { file: File, url: Link2, code_path: Code, document: FileText, credential_ref: Key };
  return map[type] || FileText;
};

const typeColor = (type) => {
  const map = {
    file: 'bg-blue-500/20 text-blue-400',
    url: 'bg-green-500/20 text-green-400',
    code_path: 'bg-purple-500/20 text-purple-400',
    document: 'bg-orange-500/20 text-orange-400',
    credential_ref: 'bg-red-500/20 text-red-400',
  };
  return map[type] || 'bg-white/10 text-slate-300';
};

const statusColor = (s) => {
  const map = {
    draft: 'bg-slate-500/20 text-slate-400',
    review: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-green-500/20 text-green-400',
    superseded: 'bg-blue-500/10 text-blue-300',
    archived: 'bg-red-500/10 text-red-300',
  };
  return map[s] || 'bg-white/10 text-slate-300';
};

const sensitivityColor = (s) => {
  const map = {
    public: 'bg-green-500/20 text-green-400',
    internal: 'bg-slate-500/20 text-slate-400',
    confidential: 'bg-red-500/20 text-red-400',
  };
  return map[s] || '';
};

export default function ArtefactDetail() {
  const { artefactId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [artefact, setArtefact] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inline content editing
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [changeComment, setChangeComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Version history
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Sticky nav scroll detection
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;
    const handleScroll = () => setIsScrolled(scrollContainer.scrollTop > 60);
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { fetchArtefact(); }, [artefactId]);

  const fetchArtefact = async () => {
    try {
      const res = await api.get(`/artefacts/${artefactId}`);
      setArtefact(res.data);
    } catch (e) {
      addToast("Failed to load artefact", "danger");
    } finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/artefacts/${artefactId}/history?page_size=50`);
      setHistory(res.data.items || []);
    } catch (e) {
      addToast("Failed to load history", "danger");
    } finally { setHistoryLoading(false); }
  };

  const handleToggleHistory = () => {
    if (!showHistory && history.length === 0) fetchHistory();
    setShowHistory(!showHistory);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const handleStatusTransition = async (newStatus) => {
    try {
      const res = await api.put(`/artefacts/${artefactId}`, { status: newStatus });
      setArtefact(res.data);
      addToast(`Status changed to ${newStatus}`, 'success');
    } catch (e) {
      addToast(e.response?.data?.detail || 'Status transition failed', 'danger');
    }
  };

  const handleSaveContent = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/artefacts/${artefactId}`, {
        content: editContent,
        change_comment: changeComment || null,
      });
      setArtefact(res.data);
      setEditing(false);
      setChangeComment('');
      addToast('Content saved', 'success');
      if (showHistory) fetchHistory();
    } catch (e) {
      addToast(e.response?.data?.detail || 'Failed to save', 'danger');
    } finally { setSaving(false); }
  };

  const handleRevert = async (historyId) => {
    if (!confirm('Revert to this version? A new history entry will be created.')) return;
    try {
      const res = await api.post(`/artefacts/${artefactId}/revert/${historyId}`, {
        change_comment: 'Reverted to earlier version',
      });
      setArtefact(res.data);
      addToast('Reverted successfully', 'success');
      fetchHistory();
    } catch (e) {
      addToast(e.response?.data?.detail || 'Revert failed', 'danger');
    }
  };

  if (loading) return <Layout title="Artefact Detail"><div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div></Layout>;
  if (!artefact) return <Layout title="Artefact Detail"><p>Artefact not found.</p></Layout>;

  const TypeIcon = typeIcon(artefact.artefact_type);

  // Group links by entity type
  const linkedTickets = (artefact.links || []).filter(l => l.linked_entity_type === 'ticket');
  const linkedArticles = (artefact.links || []).filter(l => l.linked_entity_type === 'article');
  const linkedAccounts = (artefact.links || []).filter(l => l.linked_entity_type === 'account');
  const linkedProjects = (artefact.links || []).filter(l => l.linked_entity_type === 'project');
  const linkedMilestones = (artefact.links || []).filter(l => l.linked_entity_type === 'milestone');

  // Subtitle: type + clickable account
  const subtitleContent = (
    <span>
      {artefact.artefact_type}
      {artefact.account_name && (
        <>
          {' \u2022 '}
          <button onClick={() => navigate(`/clients/${artefact.account_id}`)} className="text-sanctum-gold hover:underline">
            {artefact.account_name}
          </button>
        </>
      )}
    </span>
  );

  return (
    <Layout
      title={artefact.name}
      subtitle={subtitleContent}
      breadcrumb={[
        { label: artefact?.account_name, path: artefact?.account_id ? `/clients/${artefact.account_id}` : null },
        { label: 'Artefacts', path: '/artefacts' },
      ]}
      badges={[{ value: artefact.artefact_type, map: 'artefactType' }]}
      actions={!editing && (
        <button
          onClick={() => { setEditContent(artefact.content || ''); setEditing(true); }}
          className="flex items-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
        >
          <Edit2 size={16} /> Edit
        </button>
      )}
    >
      {/* CONTEXTUAL STICKY NAV */}
      <div className={`fixed top-16 left-0 right-0 z-20 transition-all duration-200 ${isScrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-2 flex items-center justify-between">
          <span className="text-sm font-bold truncate text-white">
            {artefact.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!editing && (
              <button
                onClick={() => { setEditContent(artefact.content || ''); setEditing(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors text-slate-300 hover:text-white"
              >
                <Edit2 size={13} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — DETAILS */}
        <div className="lg:col-span-2 space-y-6">

          {/* ALERT CARD — Superseded */}
          {artefact.status === 'superseded' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-300">This artefact has been superseded</p>
                {artefact.superseded_by ? (
                  <Link to={`/artefacts/${artefact.superseded_by}`} className="text-sm text-sanctum-gold hover:underline mt-1 inline-block">
                    View replacement artefact
                  </Link>
                ) : (
                  <p className="text-xs opacity-50 mt-1">A newer version exists but is not linked.</p>
                )}
              </div>
            </div>
          )}

          {/* ALERT CARD — Archived */}
          {artefact.status === 'archived' && (
            <div className="bg-slate-500/10 border border-slate-600 rounded-xl p-4 flex items-start gap-3">
              <Archive size={18} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-300">This artefact has been archived</p>
                <p className="text-xs opacity-50 mt-1">Archived artefacts are retained for reference but are no longer active.</p>
              </div>
            </div>
          )}

          {/* PROPERTIES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4">Properties</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div className="flex items-center gap-2">
                <TypeIcon size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Type</p>
                  <p className="text-sm font-mono">{artefact.artefact_type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="opacity-40" />
                <div>
                  <p className="text-xs opacity-50">Account</p>
                  {artefact.account_id ? (
                    <button onClick={() => navigate(`/clients/${artefact.account_id}`)} className="text-sm text-sanctum-gold hover:underline">
                      {artefact.account_name}
                    </button>
                  ) : (
                    <p className="text-sm opacity-50">Internal</p>
                  )}
                </div>
              </div>
              {artefact.category && (
                <div className="flex items-center gap-2">
                  <Tag size={14} className="opacity-40" />
                  <div>
                    <p className="text-xs opacity-50">Category</p>
                    <p className="text-sm">{artefact.category}</p>
                  </div>
                </div>
              )}
              {artefact.sensitivity && (
                <div className="flex items-center gap-2">
                  <Shield size={14} className="opacity-40" />
                  <div>
                    <p className="text-xs opacity-50">Sensitivity</p>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase ${sensitivityColor(artefact.sensitivity)}`}>
                      {artefact.sensitivity}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* URL / PATH */}
          {artefact.url && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <Link2 size={14} /> Reference
              </h3>
              {artefact.artefact_type === 'url' ? (
                <a href={artefact.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sanctum-gold hover:underline font-mono break-all">
                  {artefact.url}
                </a>
              ) : (
                <p className="text-sm font-mono opacity-80 break-all">{artefact.url}</p>
              )}
            </div>
          )}

          {/* CONTENT — hidden when no content and not editing */}
          {(artefact.content || editing) && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">Content</h3>
                {editing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(false); setChangeComment(''); }}
                      className="flex items-center gap-1 text-xs opacity-40 hover:opacity-100"
                    >
                      <X size={12} /> Cancel
                    </button>
                    <button
                      onClick={handleSaveContent}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs text-sanctum-gold hover:opacity-80"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                    </button>
                  </div>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full h-64 bg-black/30 border border-slate-600 rounded p-3 text-sm font-mono text-white focus:outline-none focus:border-sanctum-gold resize-y"
                    placeholder="Markdown content..."
                  />
                  <input
                    type="text"
                    value={changeComment}
                    onChange={e => setChangeComment(e.target.value)}
                    placeholder="Change comment (optional)"
                    className="w-full bg-black/30 border border-slate-600 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-sanctum-gold"
                  />
                </div>
              ) : (
                <div className="prose-sm">
                  <SanctumMarkdown content={artefact.content} />
                </div>
              )}
            </div>
          )}

          {/* DESCRIPTION */}
          {artefact.description && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Description</h3>
              <p className="text-sm leading-relaxed opacity-80 whitespace-pre-wrap">{artefact.description}</p>
            </div>
          )}
        </div>

        {/* RIGHT — SIDEBAR */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">

          {/* STATUS CONTROLS */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Status</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${statusColor(artefact.status)}`}>{artefact.status}</span>
            </div>
            {(artefact.available_transitions || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs opacity-50">Transition to:</p>
                <div className="flex flex-wrap gap-2">
                  {artefact.available_transitions.map(t => (
                    <button
                      key={t}
                      onClick={() => handleStatusTransition(t)}
                      className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors hover:opacity-80 ${statusColor(t)}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VERSION HISTORY */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <button
              onClick={handleToggleHistory}
              className="w-full flex items-center justify-between text-sm font-bold uppercase tracking-wider opacity-70"
            >
              <span className="flex items-center gap-2"><History size={14} /> Version History</span>
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <div className="mt-3">
                {historyLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" /></div>
                ) : history.length === 0 ? (
                  <p className="text-xs opacity-40">No version history.</p>
                ) : (
                  <div className="space-y-3">
                    {history.map(h => (
                      <div key={h.id} className="p-3 bg-black/30 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold font-mono text-sanctum-gold">{h.version}</span>
                          <button
                            onClick={() => handleRevert(h.id)}
                            className="flex items-center gap-1 text-[10px] opacity-40 hover:opacity-100 transition-opacity"
                            title="Revert to this version"
                          >
                            <RotateCcw size={10} /> Revert
                          </button>
                        </div>
                        <p className="text-[10px] opacity-50">{formatDateTime(h.snapshot_at)}</p>
                        {h.author_name && <p className="text-[10px] opacity-40">{h.author_name}</p>}
                        {h.change_comment && (
                          <p className="text-xs mt-1 opacity-60 italic">{h.change_comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LINKED PROJECTS */}
          {linkedProjects.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <FolderOpen size={14} /> Linked Projects
              </h3>
              <div className="space-y-2">
                {linkedProjects.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/projects/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors text-sm text-sanctum-gold hover:underline"
                  >
                    {l.linked_entity_name || l.linked_entity_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LINKED MILESTONES */}
          {linkedMilestones.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <Flag size={14} /> Linked Milestones
              </h3>
              <div className="space-y-2">
                {linkedMilestones.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/milestones/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors text-sm text-sanctum-gold hover:underline"
                  >
                    {l.linked_entity_name || l.linked_entity_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LINKED TICKETS */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <Ticket size={14} /> Linked Tickets
            </h3>
            {linkedTickets.length === 0 ? (
              <p className="text-xs opacity-40">No tickets linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedTickets.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/tickets/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-bold text-sanctum-gold">{l.linked_entity_name || `#${l.linked_entity_id}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LINKED ARTICLES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <BookOpen size={14} /> Linked Articles
            </h3>
            {linkedArticles.length === 0 ? (
              <p className="text-xs opacity-40">No articles linked.</p>
            ) : (
              <div className="space-y-2">
                {linkedArticles.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/wiki/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs text-sanctum-gold">{l.linked_entity_name || l.linked_entity_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* LINKED ACCOUNTS */}
          {linkedAccounts.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
                <Building2 size={14} /> Linked Accounts
              </h3>
              <div className="space-y-2">
                {linkedAccounts.map(l => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/clients/${l.linked_entity_id}`)}
                    className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-white/5 transition-colors text-sanctum-gold hover:underline text-sm font-bold"
                  >
                    {l.linked_entity_name || l.linked_entity_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* METADATA */}
          {artefact.metadata && Object.keys(artefact.metadata).length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Custom Metadata</h3>
              <div className="space-y-2 text-xs">
                {Object.entries(artefact.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="opacity-50">{k}</span>
                    <span className="font-mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* METADATA STRIP — last sidebar card */}
          <MetadataStrip
            storageKey="ds_metadata_expanded_artefact"
            collapsed={<>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(artefact.status)}`}>{artefact.status}</span>
              <span className="opacity-40">&middot;</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeColor(artefact.artefact_type)}`}>{artefact.artefact_type}</span>
              {artefact.category && <>
                <span className="opacity-40">&middot;</span>
                <span className="text-[10px] opacity-50 uppercase">{artefact.category}</span>
              </>}
              <span className="opacity-40">&middot;</span>
              <span className="opacity-50 font-mono text-[10px]">{artefact.version}</span>
              {artefact.sensitivity && artefact.sensitivity !== 'internal' && <>
                <span className="opacity-40">&middot;</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sensitivityColor(artefact.sensitivity)}`}>{artefact.sensitivity}</span>
              </>}
              <span className="opacity-40">&middot;</span>
              <span className="opacity-50">{formatDate(artefact.created_at)}</span>
              {artefact.creator_name && <>
                <span className="opacity-40">&middot;</span>
                <span className="opacity-50">{artefact.creator_name}</span>
              </>}
            </>}
            badges={[
              { label: artefact.status, className: statusColor(artefact.status) },
              { label: artefact.artefact_type, className: typeColor(artefact.artefact_type) },
              ...(artefact.sensitivity ? [{ label: artefact.sensitivity, className: sensitivityColor(artefact.sensitivity) }] : []),
            ]}
            dates={[
              { label: 'Created', value: artefact.created_at },
              { label: 'Updated', value: artefact.updated_at },
            ]}
            rows={[
              { label: 'Created By', value: artefact.creator_name || '—' },
              { label: 'Type', value: artefact.artefact_type, mono: true },
              { label: 'Version', value: artefact.version || 'v1.0', mono: true },
              { label: 'Account', value: artefact.account_name || 'Internal' },
              ...(artefact.category ? [{ label: 'Category', value: artefact.category }] : []),
              ...(artefact.sensitivity ? [{ label: 'Sensitivity', value: artefact.sensitivity }] : []),
              ...(artefact.mime_type ? [{ label: 'MIME Type', value: artefact.mime_type, mono: true }] : []),
              ...(artefact.file_size ? [{ label: 'File Size', value: `${(artefact.file_size / 1024).toFixed(1)} KB` }] : []),
            ]}
            id={artefact.id}
          />
        </div>
      </div>
    </Layout>
  );
}
