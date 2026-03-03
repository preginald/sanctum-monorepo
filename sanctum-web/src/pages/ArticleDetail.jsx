import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
// Added 'Copy' icon to imports
import { Loader2, Edit2, Calendar, User, History, Clock, FileText, Copy, Download, Send, X, AlignLeft, MessageSquare, LayoutTemplate, Link2, Unlink } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import api from '../lib/api';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
// Added Toast Hook
import { useToast } from '../context/ToastContext';

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

  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast(); // Initialize toast
   
  const [article, setArticle] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [history, setHistory] = useState([]);
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

  const fetchHistory = async (id) => {
      try {
          const res = await api.get(`/articles/${id}/history`);
          setHistory(res.data);
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
      subtitle={<>{article.identifier && <span className="font-mono opacity-70">{article.identifier}</span>} • {article.category} • <span className="font-mono">{article.version}</span> • <span className="flex inline-flex items-center gap-1"><User size={12}/> {article.author_name || 'Unknown'}</span></>}
      badge={{ label: article.category, className: categoryColor(article.category) }}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — MAIN CONTENT */}
        <div className="lg:col-span-2">

        {/* TABS */}
        <div className="flex gap-6 mb-8 border-b border-slate-800 pb-0">
          <button onClick={() => setActiveTab('content')} className={`pb-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'content' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>
            <FileText size={14} /> Content
          </button>
          <button onClick={() => setActiveTab('history')} className={`pb-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>
            <History size={14} /> History ({history.length})
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
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                    {history.length > 0 ? history.map((h, i) => (
                        <div key={h.id} className="p-4 border-b border-slate-800 last:border-0 flex justify-between items-center hover:bg-white/5 transition-colors">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-mono text-sm text-sanctum-gold font-bold">{h.version}</span>
                                    <span className="text-white font-bold text-sm">{h.title}</span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-3">
                                    <span className="flex items-center gap-1"><User size={12}/> {h.author_name || 'System'}</span>
                                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(h.snapshot_at).toLocaleString()}</span>
                                </div>
                            </div>
                            {/* Future: Add "Restore" button here */}
                            <div className="text-xs text-slate-600 font-mono uppercase tracking-widest">
                                Snapshot
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-500 italic">
                            No history records found. Edit the article to create a snapshot.
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>

        {/* RIGHT — SIDEBAR */}
        <div className="space-y-6">

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
                selectedIds={relatedArticles.map(r => r.id)}
                placeholder="Search articles to link..."
                labelKey="title"
                subLabelKey="identifier"
                icon={Link2}
              />
            </div>
          </div>

          {/* METADATA */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Metadata</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="opacity-50">Author</span>
                <span>{article.author_name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Version</span>
                <span className="font-mono text-sanctum-gold">{article.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Created</span>
                <span>{new Date(article.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-50">Updated</span>
                <span>{article.updated_at ? new Date(article.updated_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-50">ID</span>
                <span className="font-mono opacity-40 text-[10px]">{article.id}</span>
              </div>
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