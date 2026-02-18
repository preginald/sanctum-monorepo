import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, BookOpen, Download, Loader2, Calendar, User, Tag } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import usePortalNav from '../hooks/usePortalNav';
import SanctumMarkdown from '../components/ui/SanctumMarkdown';


export default function PortalArticleView() {
  const { slug } = useParams();
  const { portalNav, impersonateId } = usePortalNav();
  const { addToast } = useToast();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { fetchArticle(); }, [slug]);

  const fetchArticle = async () => {
    try {
      const imp = impersonateId ? `?impersonate=${impersonateId}` : '';
      const res = await api.get(`/portal/articles/${slug}${imp}`);
      setArticle(res.data);
    } catch (e) {
      if (e.response?.status === 403) {
        addToast("You don't have access to this article", "danger");
      } else {
        addToast("Failed to load article", "danger");
      }
    } finally { setLoading(false); }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/articles/${article.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${article.identifier || article.title}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast("PDF downloaded", "success");
    } catch (e) {
      addToast("Failed to download PDF", "danger");
    } finally { setDownloading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  if (loading) {
    return (
      <div className="min-h-screen bg-sanctum-dark flex items-center justify-center">
        <Loader2 className="animate-spin text-sanctum-gold" size={32} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-sanctum-dark text-white flex flex-col items-center justify-center gap-4">
        <BookOpen size={48} className="text-slate-500" />
        <p className="text-slate-400">Article not found or access denied.</p>
        <button onClick={() => portalNav('/portal')} className="text-sanctum-gold hover:underline text-sm">
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sanctum-dark text-white">
      {/* HEADER */}
      <div className="border-b border-slate-700 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back to Ticket
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sanctum-gold text-slate-900 hover:bg-yellow-500 disabled:opacity-50 transition-colors"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
          </div>

          <h1 className="text-3xl font-bold">{article.title}</h1>

          <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
            {article.identifier && (
              <span className="flex items-center gap-1.5">
                <Tag size={14} /> {article.identifier}
              </span>
            )}
            {article.author_name && (
              <span className="flex items-center gap-1.5">
                <User size={14} /> {article.author_name}
              </span>
            )}
            {article.updated_at && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {formatDate(article.updated_at)}
              </span>
            )}
            {article.version && (
              <span className="px-2 py-0.5 bg-white/10 rounded text-xs font-medium">{article.version}</span>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-6 py-8">
          <SanctumMarkdown content={article.content} />
      </div>

      {/* FOOTER */}
      <div className="border-t border-slate-700 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>Digital Sanctum — Knowledge Base</span>
          <span>{article.identifier} • {article.version}</span>
        </div>
      </div>
    </div>
  );
}