import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
// Added 'Copy' icon to imports
import { Loader2, Edit2, Calendar, User, History, Clock, FileText, Copy, Download, Send, X, AlignLeft, MessageSquare, LayoutTemplate, Link2, Unlink, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { diffWords } from 'diff';
import SearchableSelect from '../components/ui/SearchableSelect';
import MetadataStrip from '../components/ui/MetadataStrip';
import ArtefactCard from '../components/ArtefactCard';
import api from '../lib/api';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
// Added Toast Hook
import { useToast } from '../context/ToastContext';
import GithubSlugger from 'github-slugger';

function stripInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold **
    .replace(/__(.+?)__/g, '$1')        // bold __
    .replace(/\*(.+?)\*/g, '$1')        // italic *
    .replace(/_(.+?)_/g, '$1')          // italic _
    .replace(/`(.+?)`/g, '$1')          // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links
}

function TableOfContents({ content }) {
  if (!content) return null;

  const slugger = new GithubSlugger();
  const headings = [];
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawText = match[2].trim();
    const displayText = stripInlineMarkdown(rawText);
    headings.push({
      level: match[1].length,
      text: displayText,
      slug: slugger.slug(displayText),
    });
  }

  if (headings.length < 3) return null;

  const handleClick = (e, slug) => {
    e.preventDefault();
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
        <List size={14} /> Table of Contents
      </h3>
      <nav className="space-y-1">
        {headings.map((h, i) => (
          <a
            key={`${h.slug}-${i}`}
            href={`#${h.slug}`}
            onClick={(e) => handleClick(e, h.slug)}
            className={`block text-xs text-slate-400 hover:text-white transition-colors py-0.5 ${h.level === 3 ? 'pl-3' : ''}`}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function ArticleDetail() {
  const fetchAllArticles = async () => {
    try {
      const res = await api.get('/articles');
      setAllArticles(res.data);
    } catch(e) { console.error("Failed to load articles", e); }
  };
  const handleLinkRelation = async (relatedId) => {
    try {
      await api.post(`/articles/${article.id}/relations`, { related_id: relatedId });
      const res = await api.get(`/articles/${article.slug}?resolve_embeds=true`);
      setRelatedArticles(res.data.related_articles || []);
      setRelationSelectKey(k => k + 1);
      addToast("Related article linked", "success");
    } catch(e) {
      addToast("Failed to link article", "danger");
    }
  };
  const handleRemoveRelation = async (relatedId) => {
    try {
      await api.delete(`/articles/${article.id}/relations/${relatedId}`);
      setRelatedArticles(prev => prev.filter(r => r.id !== relatedId));
      addToast("Relation removed", "success");
    } catch(e) { addToast("Failed to remove relation", "danger"); }
  };
  const handleRefresh = () => { setRefreshKey(prev => prev + 1); };
  const handleCopyMeta = () => {
    if (!article) return "";
    return `#${article.identifier || article.id} — ${article.title}
ID: ${article.id}
Category: ${article.category}
Version: ${article.version || 'v1.0'}
Client: Digital Sanctum HQ`;
  };

  const headerSentinelRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;
    const handleScroll = () => setIsScrolled(scrollContainer.scrollTop > 60);
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast(); // Initialize toast

  const [article, setArticle] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(20);
  const [historySectionFilter, setHistorySectionFilter] = useState('');
  const [historySections, setHistorySections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('content');
  const [embedStyle, setEmbedStyle] = useState(localStorage.getItem('ds_embed_style') || 'callout');

  const handleEmbedStyleToggle = (val) => {
    setEmbedStyle(val);
    localStorage.setItem('ds_embed_style', val);
  };
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to_email: '', cc_emails: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState([]);

  const [allArticles, setAllArticles] = useState([]);
  const [selectedRelation, setSelectedRelation] = useState(null);
  const [addingRelation, setAddingRelation] = useState(false);
  const [relationSelectKey, setRelationSelectKey] = useState(0);

  const handleEmailArticle = async () => {
    if (!emailForm.to_email.trim()) return addToast("Recipient email required", "danger");
    setSendingEmail(true);
    try {
      await api.post(`/articles/${article.id}/email`, {
        to_email: emailForm.to_email,
        cc_emails: emailForm.cc_emails ? emailForm.cc_emails.split(',').map(e => e.trim()) : [],
        subject: emailForm.subject || undefined,
        message: emailForm.message || undefined
      });
      addToast(`Article sent to ${emailForm.to_email}`, "success");
      setShowEmailModal(false);
      setEmailForm({ to_email: '', cc_emails: '', subject: '', message: '' });
    } catch (e) {
      addToast("Failed to send article", "danger");
    } finally { setSendingEmail(false); }
  };

  useEffect(() => {
    fetchArticle();
  }, [slug, refreshKey]);

  const fetchArticle = async () => {
    try {
        const [res, rawRes] = await Promise.all([
            api.get(`/articles/${slug}?resolve_embeds=true`),
            api.get(`/articles/${slug}?inline_embeds=true`)
        ]);
        setArticle(res.data);
        setRelatedArticles(res.data.related_articles || []);
        setRawContent(rawRes.data.content || '');
        fetchHistory(res.data.id);
        fetchAllArticles();
    } catch(e) {
        console.error(e);
        navigate('/wiki');
    } finally {
        setLoading(false);
    }
  };

  const fetchHistory = async (id, page = 1, sectionFilter = '') => {
      try {
          const params = new URLSearchParams({ page, page_size: 20 });
          if (sectionFilter) params.append('section_heading', sectionFilter);
          const res = await api.get(`/articles/${id}/history?${params}`);
          setHistory(res.data.items);
          setHistoryTotal(res.data.total);
          setHistoryPage(res.data.page);
          // Build unique section list from first page load (no filter)
          if (!sectionFilter && page === 1) {
              const allRes = await api.get(`/articles/${id}/history?page=1&page_size=200`);
              const sections = [...new Set(allRes.data.items.map(h => h.section_heading).filter(Boolean))];
              setHistorySections(sections);
          }
      } catch(e) { console.error("Failed to load history", e); }
  };

  // NEW: Copy Logic
  const handleCopyMarkdown = async () => {
    try {
      const metadata = [
        '---',
        `Title: ${article.title}`,
        `ID: ${article.id}`,
        `Identifier: ${article.identifier || 'N/A'}`,
        `Version: ${article.version || 'v1.0'}`,
        `Category: ${article.category}`,
        '---',
        '',
        rawContent
      ].join('\n');

      await navigator.clipboard.writeText(metadata);
      addToast('Markdown copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy!', err);
      addToast('Failed to copy markdown', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/articles/${article.id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${article.identifier || article.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast("PDF downloaded", "success");
    } catch (err) {
      console.error("PDF download failed", err);
      addToast("Failed to download PDF", "error");
    }
  };

  const categoryColor = (c) => {
    const map = { sop: 'bg-blue-500/20 text-blue-400', wiki: 'bg-green-500/20 text-green-400', template: 'bg-purple-500/20 text-purple-400', troubleshooting: 'bg-orange-500/20 text-orange-400' };
    return map[c] || 'bg-white/10 text-slate-300';
  };

  if (loading || !article) return <Layout
      onRefresh={handleRefresh}
      onCopyMeta={handleCopyMeta} title="Loading..."><Loader2 className="animate-spin"/></Layout>;


  return (
    <Layout
      onRefresh={handleRefresh}
      onCopyMeta={handleCopyMeta}
      viewMode={embedStyle}
      onViewToggle={handleEmbedStyleToggle}
      viewToggleOptions={[
        { value: 'seamless', icon: <AlignLeft size={14} /> },
        { value: 'callout', icon: <MessageSquare size={14} /> },
        { value: 'card', icon: <LayoutTemplate size={14} /> }
      ]}
      title={article.title}
      badge={null}
      breadcrumb={[{ label: 'Library', path: '/wiki' }, { label: article.category }]}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={handleCopyMarkdown} className="flex items-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors text-slate-300 hover:text-white" title="Copy Markdown with Metadata">
            <Copy size={16} /> Copy
          </button>
          <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors text-slate-300 hover:text-white" title="Download as PDF">
            <Download size={16} /> PDF
          </button>
          <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-2 px-3 py-2 rounded bg-sanctum-gold/20 hover:bg-sanctum-gold/30 text-sm font-bold transition-colors text-sanctum-gold" title="Email article to client">
            <Send size={16} /> Email
          </button>
          <button onClick={() => navigate(`/wiki/${article.id}/edit`)} className="flex items-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors">
            <Edit2 size={16} /> Edit
          </button>
        </div>
      }
    >
      {/* STICKY NAV */}
      <div className={`fixed top-16 left-0 right-0 z-20 transition-all duration-200 ${isScrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-2 flex items-center justify-between">
          <span className="text-sm font-bold truncate text-white">
            {article.identifier && <span className="text-sanctum-gold font-mono mr-2">{article.identifier}</span>}
            {article.title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors text-slate-300 hover:text-white">
              <Download size={13} /> PDF
            </button>
            <button onClick={() => navigate(`/wiki/${article.id}/edit`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors text-slate-300 hover:text-white">
              <Edit2 size={13} /> Edit
            </button>
          </div>
        </div>
      </div>
      {/* HEADER SENTINEL */}
      <div ref={headerSentinelRef} className="h-0 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:h-[calc(100vh-9rem)] gap-6">
        {/* LEFT — MAIN CONTENT */}
        <div className="lg:col-span-2 lg:overflow-y-auto scrollbar-thin">

        {/* TABS */}
        <div className="flex gap-6 mb-8 border-b border-slate-800 pb-0">
          <button onClick={() => setActiveTab('content')} className={`pb-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'content' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>
            <FileText size={14} /> Content
          </button>
          <button onClick={() => setActiveTab('history')} className={`pb-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>
            <History size={14} /> History ({historyTotal > 0 ? historyTotal : history.length})
          </button>
        </div>

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
            <div className={`pb-20 animate-in fade-in duration-200 embed-style-${embedStyle}`}>
                <SanctumMarkdown content={article.content} />
            </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
            <div className="animate-in slide-in-from-left-2 duration-200">
                {/* Section filter + pagination header */}
                <div className="flex items-center justify-between mb-3 gap-3">
                    <select
                        value={historySectionFilter}
                        onChange={e => { setHistorySectionFilter(e.target.value); fetchHistory(article.id, 1, e.target.value); }}
                        className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-sanctum-gold"
                    >
                        <option value="">All sections</option>
                        {historySections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-xs text-slate-500">{historyTotal} entries</span>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                    {history.length > 0 ? history.map((h) => {
                        const wordDiff = h.diff_before != null && h.diff_after != null
                            ? diffWords(h.diff_before, h.diff_after)
                            : null;
                        return (
                        <div key={h.id} className="p-4 border-b border-slate-800 last:border-0 hover:bg-white/5 transition-colors">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-mono text-sm text-sanctum-gold font-bold">{h.version}</span>
                                        <span className="text-white font-bold text-sm">{h.title}</span>
                                        {h.section_heading ? (
                                            <span className="text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono">{h.section_heading}</span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded">Full article</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-3 mb-2">
                                        <span className="flex items-center gap-1"><User size={12}/> {h.author_name || 'System'}</span>
                                        <span className="flex items-center gap-1"><Clock size={12}/> {new Date(h.snapshot_at).toLocaleString()}</span>
                                    </div>
                                    {h.change_comment && (
                                        <div className="text-xs text-slate-400 italic mb-2 flex items-center gap-1.5">
                                            <span className="text-slate-600">—</span> {h.change_comment}
                                        </div>
                                    )}
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={() => { if(window.confirm(`Revert article to ${h.version}?`)) { api.post(`/articles/${article.id}/revert/${h.id}`, { change_comment: `Reverted to ${h.version}` }).then(() => { addToast("Article reverted", "success"); fetchArticle(); fetchHistory(article.id, historyPage, historySectionFilter); }).catch(() => addToast("Revert failed", "danger")); }}} className="text-[10px] px-2 py-0.5 rounded bg-sanctum-gold/10 text-sanctum-gold border border-sanctum-gold/20 hover:bg-sanctum-gold/20 transition-colors">Revert to this version</button>
                                    </div>
                                    {wordDiff && (
                                        <div className="mt-1 bg-slate-800 border border-slate-700 rounded p-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
                                            {wordDiff.map((part, idx) => (
                                                <span
                                                    key={idx}
                                                    className={
                                                        part.added ? 'bg-green-500/25 text-green-300' :
                                                        part.removed ? 'bg-red-500/25 text-red-300 line-through' :
                                                        'text-slate-400'
                                                    }
                                                >{part.value}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        );
                    }) : (
                        <div className="p-8 text-center text-slate-500 italic">
                            No history records found. Edit the article to create a snapshot.
                        </div>
                    )}
                </div>
                {/* Pagination controls */}
                {historyTotal > historyPageSize && (
                    <div className="flex items-center justify-between mt-3">
                        <button
                            onClick={() => { const p = historyPage - 1; setHistoryPage(p); fetchHistory(article.id, p, historySectionFilter); }}
                            disabled={historyPage <= 1}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        ><ChevronLeft size={14}/> Prev</button>
                        <span className="text-xs text-slate-500">Page {historyPage} of {Math.ceil(historyTotal / historyPageSize)}</span>
                        <button
                            onClick={() => { const p = historyPage + 1; setHistoryPage(p); fetchHistory(article.id, p, historySectionFilter); }}
                            disabled={historyPage >= Math.ceil(historyTotal / historyPageSize)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >Next <ChevronRight size={14}/></button>
                    </div>
                )}
            </div>
        )}
        </div>

        {/* RIGHT — SIDEBAR */}
        <div className="space-y-6 lg:overflow-y-auto scrollbar-thin">

          {/* METADATA STRIP */}
          <MetadataStrip
            storageKey="ds_metadata_expanded_article"
            collapsed={<>
              {article.identifier && <span className="font-mono text-sanctum-gold bg-sanctum-gold/10 border border-sanctum-gold/20 px-1.5 py-0.5 rounded text-[10px]">{article.identifier}</span>}
              {article.identifier && <span className="opacity-40">·</span>}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-slate-300">{article.category}</span>
              <span className="opacity-40">·</span>
              <span className="opacity-50">{new Date(article.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </>}
            badges={[
              ...(article.identifier ? [{ label: article.identifier, mono: true }] : []),
              { label: article.category, className: 'bg-white/10 text-slate-300' },
              { label: article.version, className: 'bg-sanctum-gold/10 text-sanctum-gold border border-sanctum-gold/20' },
              { label: article.author_name || 'Unknown', className: 'bg-white/10 text-slate-300' },
            ]}
            rows={[]}
            dates={[
              { label: 'Created', value: article.created_at },
              { label: 'Updated', value: article.updated_at },
            ]}
            id={article.id}
          />

          {/* ARTEFACTS */}
          <ArtefactCard entityType="article" entityId={article.id} artefacts={article.artefacts || []} onUpdate={fetchArticle} />

          {/* TABLE OF CONTENTS */}
          <TableOfContents content={article.content} />

          {/* RELATED ARTICLES */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3 flex items-center gap-2">
              <Link2 size={14} /> Related Articles
            </h3>
            {relatedArticles.length === 0 ? (
              <p className="text-xs opacity-40 mb-3">No related articles linked.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {relatedArticles.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 bg-black/30 rounded-lg group">
                    <button
                      onClick={() => navigate(`/wiki/${r.slug}`)}
                      className="text-left flex-1 min-w-0"
                    >
                      {r.identifier && (
                        <span className="text-[10px] font-mono text-sanctum-gold opacity-70 block">{r.identifier}</span>
                      )}
                      <span className="text-xs text-white hover:text-sanctum-gold transition-colors truncate block">{r.title}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveRelation(r.id)}
                      className="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all text-slate-500"
                      title="Unlink"
                    >
                      <Unlink size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2">
              <SearchableSelect
                key={relationSelectKey}
                items={allArticles.filter(a => a.id !== article?.id && !relatedArticles.find(r => r.id === a.id))}
                onSelect={(item) => handleLinkRelation(item.id)}
                selectedIds={[]}
                placeholder="Search articles to link..."
                labelKey="title"
                subLabelKey="identifier"
                icon={Link2}
              />
            </div>
          </div>



        </div>
      </div>
      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowEmailModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Email Article to Client</h3>
              <button onClick={() => setShowEmailModal(false)} className="p-1 hover:bg-white/10 rounded"><X size={18} /></button>
            </div>
            <div className="text-xs text-slate-400 bg-white/5 p-3 rounded">
              <strong className="text-sanctum-gold">{article.identifier}</strong> — {article.title}
            </div>
            <div className="space-y-3">
              <input
                type="email" placeholder="Recipient email *" value={emailForm.to_email}
                onChange={e => setEmailForm({...emailForm, to_email: e.target.value})}
                className="w-full p-3 bg-black/30 border border-slate-700 rounded text-sm focus:outline-none focus:border-sanctum-gold"
              />
              <input
                type="text" placeholder="CC emails (comma separated)" value={emailForm.cc_emails}
                onChange={e => setEmailForm({...emailForm, cc_emails: e.target.value})}
                className="w-full p-3 bg-black/30 border border-slate-700 rounded text-sm focus:outline-none focus:border-sanctum-gold"
              />
              <input
                type="text" placeholder="Subject (optional)" value={emailForm.subject}
                onChange={e => setEmailForm({...emailForm, subject: e.target.value})}
                className="w-full p-3 bg-black/30 border border-slate-700 rounded text-sm focus:outline-none focus:border-sanctum-gold"
              />
              <textarea
                placeholder="Personal message (optional)" value={emailForm.message}
                onChange={e => setEmailForm({...emailForm, message: e.target.value})}
                className="w-full p-3 bg-black/30 border border-slate-700 rounded text-sm focus:outline-none focus:border-sanctum-gold min-h-[80px]"
              />
            </div>
            <button
              onClick={handleEmailArticle} disabled={sendingEmail}
              className="w-full py-3 rounded font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sendingEmail ? 'Sending...' : 'Send Article'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
