import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, Save, ArrowLeft, Eye, Edit3 } from 'lucide-react';
import api from '../lib/api';
// IMPORT SHARED MARKDOWN COMPONENT
import SanctumMarkdown from '../components/ui/SanctumMarkdown';
import { useToast } from '../context/ToastContext';
import { ARTICLE_CATEGORIES } from '../lib/constants';

export default function ArticleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(!!id);
  const [formData, setFormData] = useState({
    title: '', slug: '', category: 'wiki', identifier: '', version: 'v1.0', content: ''
  });
  const [activeTab, setActiveTab] = useState('write'); 

  useEffect(() => {
    if (id) {
      api.get(`/articles/${id}`)
         .then(res => {
             setFormData({
                 title: res.data.title,
                 slug: res.data.slug,
                 category: res.data.category,
                 identifier: res.data.identifier || '',
                 version: res.data.version,
                 content: res.data.content
             });
             setLoading(false);
         })
         .catch(e => { console.error(e); navigate('/wiki'); });
    }
  }, [id, navigate]);

  const handleTitleChange = (e) => {
      const title = e.target.value;
      if (!id) {
          const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          setFormData(prev => ({ ...prev, title, slug }));
      } else {
          setFormData(prev => ({ ...prev, title }));
      }
  };

  const handleSave = async (e) => {
      e.preventDefault();
      try {
          if (id) {
              await api.put(`/articles/${id}`, formData);
              addToast("Article updated", "success");
              navigate(`/wiki/${formData.slug}`);
          } else {
              const res = await api.post('/articles', formData);
              addToast("Article created", "success");
              navigate(`/wiki/${res.data.slug}`);
          }
      } catch (e) {
          addToast("Failed to save article. Slug might be duplicate.", "danger");
      }
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title={id ? "Edit Article" : "New Article"}>
      <form onSubmit={handleSave} className="h-[calc(100vh-140px)] flex flex-col">
          
          {/* TOOLBAR */}
          <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                  <button type="button" onClick={() => navigate('/wiki')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20}/></button>
                  <h1 className="text-2xl font-bold">{id ? 'Edit Article' : 'New Article'}</h1>
              </div>
              <div className="flex gap-2">
                  <div className="flex bg-slate-800 rounded p-1 border border-slate-700">
                      <button type="button" onClick={() => setActiveTab('write')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 ${activeTab==='write' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><Edit3 size={14}/> Write</button>
                      <button type="button" onClick={() => setActiveTab('preview')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-2 ${activeTab==='preview' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}><Eye size={14}/> Preview</button>
                  </div>
                  <button type="submit" className="flex items-center gap-2 px-6 py-2 rounded bg-sanctum-gold hover:bg-yellow-500 text-slate-900 font-bold shadow-lg">
                      <Save size={18} /> Save Article
                  </button>
              </div>
          </div>

          {/* METADATA BAR */}
          <div className="grid grid-cols-12 gap-4 mb-4 bg-slate-900 p-4 rounded border border-slate-700">
              <div className="col-span-4">
                  <label className="text-xs opacity-50 block mb-1">Title</label>
                  <input required className="w-full bg-black/40 border border-slate-600 rounded p-2 text-white font-bold" value={formData.title} onChange={handleTitleChange} />
              </div>
              <div className="col-span-3">
                  <label className="text-xs opacity-50 block mb-1">Slug (URL)</label>
                  <input required className="w-full bg-black/40 border border-slate-600 rounded p-2 text-white font-mono text-sm" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs opacity-50 block mb-1">Category</label>
                  <select 
                      className="w-full bg-black/40 border border-slate-600 rounded p-2 text-white capitalize" 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                      {ARTICLE_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                      ))}
                  </select>
              </div>
              <div className="col-span-2">
                  <label className="text-xs opacity-50 block mb-1">ID (e.g. DS-SOP-001)</label>
                  <input className="w-full bg-black/40 border border-slate-600 rounded p-2 text-white font-mono text-sm" value={formData.identifier} onChange={e => setFormData({...formData, identifier: e.target.value})} />
              </div>
              <div className="col-span-1">
                  <label className="text-xs opacity-50 block mb-1">Version</label>
                  <input className="w-full bg-black/40 border border-slate-600 rounded p-2 text-white font-mono text-sm" value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})} />
              </div>
          </div>

          {/* EDITOR AREA */}
          <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex">
              {/* WRITE PANE */}
              <div className={`flex-1 flex flex-col ${activeTab === 'preview' ? 'hidden' : 'block'}`}>
                  <textarea 
                    className="flex-1 w-full bg-transparent p-6 text-slate-300 font-mono text-sm outline-none resize-none" 
                    placeholder="# Start writing your SOP here..."
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                  />
              </div>

              {/* PREVIEW PANE */}
              <div className={`flex-1 bg-slate-950 p-8 overflow-y-auto border-l border-slate-800 ${activeTab === 'write' ? 'hidden md:block' : 'block'}`}>
                   <SanctumMarkdown content={formData.content || "*Preview will appear here...*"} />
              </div>
          </div>

      </form>
    </Layout>
  );
}