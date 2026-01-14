import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Edit2, Calendar, User } from 'lucide-react';
import api from '../lib/api';
// IMPORT SHARED MARKDOWN COMPONENT
import SanctumMarkdown from '../components/ui/SanctumMarkdown';

export default function ArticleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/articles/${slug}`)
       .then(res => { setArticle(res.data); setLoading(false); })
       .catch(e => { console.error(e); navigate('/wiki'); });
  }, [slug, navigate]);

  if (loading || !article) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title={article.title}>
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
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
                <span className="flex items-center gap-2"><User size={14}/> Author ID: {article.author_id?.slice(0,8)}...</span>
                <span className="flex items-center gap-2"><Calendar size={14}/> Updated: {new Date(article.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/wiki/${article.id}/edit`)} 
            className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
          >
            <Edit2 size={16} /> Edit Article
          </button>
        </div>

        {/* CONTENT */}
        <div className="pb-20">
          <SanctumMarkdown content={article.content} />
        </div>
      </div>
    </Layout>
  );
}