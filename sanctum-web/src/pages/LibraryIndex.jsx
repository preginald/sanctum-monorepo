import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { BookOpen, ShieldCheck, Download, Loader2, Plus, Wrench } from 'lucide-react';
import api from '../lib/api';
// IMPORT CARD
import ArticleCard from '../components/knowledge/ArticleCard';

export default function LibraryIndex() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/articles').then(res => {
      setArticles(res.data);
      setLoading(false);
    });
  }, []);

  const sops = articles.filter(a => a.category === 'sop');
  const templates = articles.filter(a => a.category === 'template');
  const wikis = articles.filter(a => a.category === 'wiki');
  const troubleshooting = articles.filter(a => a.category === 'troubleshooting');

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout
      title="The Library"
      subtitle="SOPs, templates, wiki articles, and troubleshooting guides"
      actions={
        <button onClick={() => navigate('/wiki/new')} className="bg-sanctum-gold hover:bg-yellow-500 text-slate-900 px-4 py-2 rounded font-bold text-sm shadow flex items-center gap-2">
          <Plus size={16} /> New Article
        </button>
      }
    >

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* LEFT COLUMN */}
        <div className="space-y-12">
          
          {/* SOP REGISTRY */}
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <ShieldCheck className="text-sanctum-gold" /> SOP Registry
              <span className="text-xs font-mono opacity-50 ml-auto">PROCEDURES</span>
            </h2>
            <div className="space-y-4">
              {sops.map(sop => (
                  <ArticleCard key={sop.id} article={sop} textClass="text-white group-hover:text-sanctum-gold" />
              ))}
              {sops.length === 0 && <p className="text-sm opacity-50 italic">No SOPs found.</p>}
            </div>
          </div>

          {/* TROUBLESHOOTING */}
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <Wrench className="text-orange-400" /> Troubleshooting
              <span className="text-xs font-mono opacity-50 ml-auto">DIAGNOSTICS</span>
            </h2>
            <div className="space-y-4">
              {troubleshooting.map(guide => (
                <ArticleCard 
                    key={guide.id} 
                    article={guide} 
                    colorClass="bg-orange-900/10 border-orange-500/30 hover:bg-orange-900/20 hover:border-orange-500/50"
                    textClass="text-white group-hover:text-orange-200"
                />
              ))}
              {troubleshooting.length === 0 && <p className="text-sm opacity-50 italic">No guides found.</p>}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-12">
          
          {/* TEMPLATES */}
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <Download className="text-blue-400" /> Resource Library
              <span className="text-xs font-mono opacity-50 ml-auto">TEMPLATES</span>
            </h2>
            <div className="space-y-4">
              {templates.map(tpl => (
                  <ArticleCard key={tpl.id} article={tpl} textClass="text-white group-hover:text-blue-300" />
              ))}
              {templates.length === 0 && <p className="text-sm opacity-50 italic">No templates found.</p>}
            </div>
          </div>

          {/* WIKI */}
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <BookOpen className="text-purple-400" /> Engineering Wiki
              <span className="text-xs font-mono opacity-50 ml-auto">SYSTEMS</span>
            </h2>
            <div className="space-y-4">
              {wikis.map(wiki => (
                <ArticleCard 
                    key={wiki.id} 
                    article={wiki} 
                    colorClass="bg-purple-900/10 border-purple-500/30 hover:bg-purple-900/20 hover:border-purple-500/50"
                    textClass="text-white group-hover:text-purple-200"
                />
              ))}
              {wikis.length === 0 && <p className="text-sm opacity-50 italic">No wiki entries found.</p>}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}