import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
// Added 'Copy' icon to imports
import { Loader2, ArrowLeft, Edit2, Calendar, User, History, Clock, FileText, Copy, Download, Send, X } from 'lucide-react';
import api from '../lib/api';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
// Added Toast Hook
import { useToast } from '../context/ToastContext';

export default function ArticleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast(); // Initialize toast
   
  const [article, setArticle] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to_email: '', cc_emails: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

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
  }, [slug]);

  const fetchArticle = async () => {
    try {
        const res = await api.get(`/articles/${slug}`);
        setArticle(res.data);
        fetchHistory(res.data.id);
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
        `Identifier: ${article.identifier || 'N/A'}`,
        `Version: ${article.version || 'v1.0'}`,
        `Category: ${article.category}`,
        '---',
        '',
        article.content
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

  if (loading || !article) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  const layoutTitle = article.identifier || 'Wiki Entry';

  return (
    <Layout title={layoutTitle}> 
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="mb-8 border-b border-slate-800 pb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-4">
                <button onClick={() => navigate('/wiki')} className="p-2 rounded hover:bg-white/10 opacity-70 mt-1">
                <ArrowLeft size={20} />
                </button>
                <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono uppercase tracking-widest bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                    {article.category}
                    </span>
                    {article.identifier && (
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
                        {article.identifier}
                    </span>
                    )}
                    <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-slate-400">
                    {article.version}
                    </span>
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 leading-tight">{article.title}</h1>
                <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span className="flex items-center gap-2"><User size={14}/> Author: {article.author_name || 'Unknown'}</span>
                    <span className="flex items-center gap-2"><Calendar size={14}/> Updated: {new Date(article.updated_at || article.created_at).toLocaleDateString()}</span>
                </div>
                </div>
            </div>
            
            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleCopyMarkdown} 
                    className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors text-slate-300 hover:text-white"
                    title="Copy Markdown with Metadata"
                >
                    <Copy size={16} /> Copy Markdown
                </button>
                <button 
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors text-slate-300 hover:text-white"
                    title="Download as PDF"
                >
                    <Download size={16} /> PDF
                </button>
                <button 
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-sanctum-gold/20 hover:bg-sanctum-gold/30 text-sm font-bold transition-colors text-sanctum-gold"
                    title="Email article to client"
                >
                    <Send size={16} /> Email
                </button>
                <button 
                    onClick={() => navigate(`/wiki/${article.id}/edit`)} 
                    className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
                >
                    <Edit2 size={16} /> Edit Article
                </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-6 mt-4">
              <button 
                onClick={() => setActiveTab('content')} 
                className={`pb-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'content' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}
              >
                  <FileText size={14} /> Content
              </button>
              <button 
                onClick={() => setActiveTab('history')} 
                className={`pb-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'history' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}
              >
                  <History size={14} /> History ({history.length})
              </button>
          </div>
        </div>

        {/* CONTENT TAB */}
        {activeTab === 'content' && (
            <div className="pb-20 animate-in fade-in duration-200">
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