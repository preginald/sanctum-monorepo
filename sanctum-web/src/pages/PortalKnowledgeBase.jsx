import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Loader2, Tag, Calendar, User, FileText } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import usePortalNav from '../hooks/usePortalNav';

export default function PortalKnowledgeBase() {
  const { portalNav, impersonateId } = usePortalNav();
  const { addToast } = useToast();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => { fetchArticles(); }, [search]);

  const fetchArticles = async () => {
    try {
      const imp = impersonateId ? `impersonate=${impersonateId}` : '';
      const s = search ? `search=${encodeURIComponent(search)}` : '';
      const params = [imp, s].filter(Boolean).join('&');
      const url = `/portal/articles${params ? '?' + params : ''}`;
      const res = await api.get(url);
      setArticles(res.data);
    } catch (e) {
      addToast("Failed to load articles", "danger");
    } finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const categoryColor = (c) => {
    const map = { sop: 'bg-blue-500/20 text-blue-400', wiki: 'bg-green-500/20 text-green-400', template: 'bg-purple-500/20 text-purple-400', guide: 'bg-orange-500/20 text-orange-400' };
    return map[c] || 'bg-white/10 text-slate-400';
  };

  return (
    <div className="min-h-screen bg-sanctum-dark text-white">
      {/* HEADER */}
      <div className="border-b border-slate-700 bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => portalNav('/portal')}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Portal
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={28} className="text-sanctum-gold" />
            <h1 className="text-3xl font-bold">Knowledge Base</h1>
          </div>
          <p className="text-sm text-slate-400">Articles and documentation shared with your organisation.</p>

          {/* SEARCH */}
          <form onSubmit={handleSearch} className="mt-5">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search articles by title, reference, or content..."
                className="w-full pl-12 pr-4 py-3 bg-black/30 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-sanctum-gold transition-colors"
              />
              {searchInput && searchInput !== search && (
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-sanctum-gold text-slate-900 rounded text-xs font-bold">
                  Search
                </button>
              )}
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-sanctum-gold" size={32} />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-bold text-slate-400">
              {search ? `No articles matching "${search}"` : 'No articles have been shared with your organisation yet.'}
            </p>
            {search && (
              <button onClick={() => { setSearch(''); setSearchInput(''); }} className="mt-3 text-sm text-sanctum-gold hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase font-bold mb-4">
              {articles.length} article{articles.length !== 1 ? 's' : ''} {search && `matching "${search}"`}
            </p>
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => portalNav(`/portal/wiki/${article.slug}`)}
                className="w-full text-left p-5 bg-slate-900 border border-slate-700 rounded-xl hover:border-sanctum-gold/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {article.identifier && (
                        <span className="text-[10px] font-bold text-sanctum-gold opacity-70">{article.identifier}</span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${categoryColor(article.category)}`}>
                        {article.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg group-hover:text-sanctum-gold transition-colors">{article.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={12} /> {article.author_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(article.updated_at)}
                      </span>
                      {article.version && (
                        <span>{article.version}</span>
                      )}
                    </div>
                  </div>
                  <BookOpen size={20} className="text-slate-600 group-hover:text-sanctum-gold transition-colors mt-1 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}