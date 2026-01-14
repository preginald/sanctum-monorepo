import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { BookOpen, ShieldCheck, Download, Loader2, Plus } from 'lucide-react';
import api from '../lib/api';

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

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title="Resource Library">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Operational Dashboard</h1>
          <p className="text-slate-500">Welcome to the Digital Sanctum internal network.</p>
        </div>
        <button onClick={() => navigate('/wiki/new')} className="bg-sanctum-gold hover:bg-yellow-500 text-slate-900 px-4 py-2 rounded font-bold text-sm shadow flex items-center gap-2">
          <Plus size={16} /> New Article
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* LEFT COLUMN: SOP REGISTRY */}
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
            <ShieldCheck className="text-sanctum-gold" /> SOP Registry
            <span className="text-xs font-mono opacity-50 ml-auto">PROCEDURES</span>
          </h2>
          <div className="space-y-4">
            {sops.map(sop => (
              <div key={sop.id} onClick={() => navigate(`/wiki/${sop.slug}`)} className="p-4 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg cursor-pointer transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono opacity-50 uppercase tracking-widest">{sop.identifier}</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded border border-white/5 font-mono">{sop.version}</span>
                </div>
                <h3 className="text-lg font-bold group-hover:text-sanctum-gold transition-colors">{sop.title}</h3>
              </div>
            ))}
            {sops.length === 0 && <p className="text-sm opacity-50 italic">No SOPs found in the database.</p>}
          </div>
        </div>

        {/* RIGHT COLUMN: RESOURCES & WIKI */}
        <div className="space-y-12">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <Download className="text-blue-400" /> Resource Library
              <span className="text-xs font-mono opacity-50 ml-auto">TEMPLATES</span>
            </h2>
            <div className="space-y-4">
              {templates.map(tpl => (
                <div key={tpl.id} onClick={() => navigate(`/wiki/${tpl.slug}`)} className="p-4 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-lg cursor-pointer transition-all">
                  <span className="text-xs font-mono text-blue-400 mb-1 block uppercase tracking-widest">Template</span>
                  <h3 className="text-lg font-bold">{tpl.title}</h3>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
              <BookOpen className="text-purple-400" /> Engineering Wiki
              <span className="text-xs font-mono opacity-50 ml-auto">SYSTEMS</span>
            </h2>
            <div className="space-y-4">
              {wikis.map(wiki => (
                <div key={wiki.id} onClick={() => navigate(`/wiki/${wiki.slug}`)} className="p-4 bg-purple-900/10 border border-purple-500/30 hover:bg-purple-900/20 rounded-lg cursor-pointer transition-all">
                  <h3 className="font-bold text-purple-100">{wiki.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}