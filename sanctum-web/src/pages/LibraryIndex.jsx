import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { 
  BookOpen, ShieldCheck, Download, Loader2, Plus, Wrench, 
  LayoutGrid, List, CheckSquare, FolderInput, Trash2 
} from "lucide-react";
import api from "../lib/api";
import ArticleCard from "../components/knowledge/ArticleCard";
import Badge from "../components/ui/Badge";
import Checkbox from "../components/ui/Checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "../components/ui/Table";

export default function LibraryIndex() {
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState(localStorage.getItem("kb_view_mode") || "grid");

  useEffect(() => {
    localStorage.setItem("kb_view_mode", viewMode);
  }, [viewMode, refreshKey]);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadArticles();
  }, [refreshKey]);

  const loadArticles = () => {
    setLoading(true);
    api.get("/articles").then(res => {
      setArticles(res.data);
      setLoading(false);
    });
  };

  // Filter logic for Grid View
  const sops = articles.filter(a => a.category === "sop");
  const templates = articles.filter(a => a.category === "template");
  const wikis = articles.filter(a => a.category === "wiki");
  const troubleshooting = articles.filter(a => a.category === "troubleshooting");

  const getCategoryBadge = (cat) => {
    switch(cat) {
      case "sop": return <Badge variant="gold">SOP</Badge>;
      case "template": return <Badge variant="info">Template</Badge>;
      case "troubleshooting": return <Badge variant="danger">Guide</Badge>;
      default: return <Badge variant="default">Wiki</Badge>;
    }
  };

  // Bulk Handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(articles.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkCategory = async (newCategory) => {
    if (!window.confirm(`Move ${selectedIds.length} articles to ${newCategory}?`)) return;
    
    setProcessing(true);
    try {
      // Execute sequentially to avoid rate limits/race conditions
      for (const id of selectedIds) {
        const article = articles.find(a => a.id === id);
        await api.put(`/articles/${id}`, { ...article, category: newCategory });
      }
      setSelectedIds([]);
      loadArticles();
    } catch (err) {
      console.error("Bulk update failed", err);
      alert("Failed to update some articles. Check console.");
    } finally {
      setProcessing(false);
    }
  };

  // Dynamic Actions Bar
  const renderActions = () => {
    if (selectedIds.length > 0) {
      return (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-bold text-sanctum-gold mr-2">
            {selectedIds.length} Selected
          </span>
          
          <div className="h-6 w-px bg-slate-700 mx-2"></div>

          <button 
            disabled={processing}
            onClick={() => handleBulkCategory("sop")}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded flex items-center gap-2 transition-colors text-white"
          >
            <ShieldCheck size={14} className="text-sanctum-gold" /> To SOP
          </button>

          <button 
            disabled={processing}
            onClick={() => handleBulkCategory("wiki")}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded flex items-center gap-2 transition-colors text-white"
          >
            <BookOpen size={14} className="text-blue-400" /> To Wiki
          </button>

          <button 
            disabled={processing}
            onClick={() => handleBulkCategory("template")}
            className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded flex items-center gap-2 transition-colors text-white"
          >
            <Download size={14} className="text-purple-400" /> To Template
          </button>

          <button 
            disabled={processing}
            onClick={() => setSelectedIds([])}
            className="ml-2 text-slate-500 hover:text-white text-xs"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/wiki/new")} className="bg-sanctum-gold hover:bg-yellow-500 text-slate-900 px-4 py-2 rounded font-bold text-sm shadow flex items-center gap-2">
          <Plus size={16} /> New Article
        </button>
      </div>
    );
  };

  if (loading && !articles.length) return <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="Loading..."><div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div></Layout>;

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)}
      title="The Library"
      subtitle="SOPs, templates, wiki articles, and troubleshooting guides"
      actions={renderActions()}
      viewMode={viewMode}
      onViewToggle={setViewMode}
      viewToggleOptions={[
        { value: 'grid', icon: <LayoutGrid size={14} /> },
        { value: 'list', icon: <List size={14} /> }
      ]}
    >

      {viewMode === "grid" ? (
        /* GRID VIEW (Original Layout) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* LEFT COLUMN */}
          <div className="space-y-12">
            
            {/* SOP REGISTRY */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
                <ShieldCheck className="text-sanctum-gold" /> Standard Operating Procedures
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {sops.map(sop => (
                    <ArticleCard key={sop.id} article={sop} textClass="text-white group-hover:text-sanctum-gold" />
                ))}
                {sops.length === 0 && <div className="text-slate-500 italic">No SOPs found.</div>}
              </div>
            </div>

            {/* TROUBLESHOOTING */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
                <Wrench className="text-red-400" /> Troubleshooting Guides
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {troubleshooting.map(guide => (
                  <ArticleCard 
                    key={guide.id} 
                    article={guide} 
                    colorClass="bg-red-900/10 border-red-900/30 hover:border-red-500/50"
                    textClass="text-white group-hover:text-red-300" 
                  />
                ))}
                {troubleshooting.length === 0 && <div className="text-slate-500 italic">No guides found.</div>}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-12">

            {/* TEMPLATES */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
                <Download className="text-blue-400" /> Templates & Downloads
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {templates.map(tpl => (
                    <ArticleCard key={tpl.id} article={tpl} textClass="text-white group-hover:text-blue-300" />
                ))}
                {templates.length === 0 && <div className="text-slate-500 italic">No templates found.</div>}
              </div>
            </div>

            {/* WIKI */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
                <BookOpen className="text-slate-400" /> General Wiki
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {wikis.map(wiki => (
                  <ArticleCard 
                    key={wiki.id} 
                    article={wiki} 
                    colorClass="bg-slate-800/50 border-slate-700 hover:border-slate-500"
                  />
                ))}
                {wikis.length === 0 && <div className="text-slate-500 italic">No articles found.</div>}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* LIST VIEW (Unified Table Layout) */
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedIds.length === articles.length && articles.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[100px]">Identifier</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="text-right">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow 
                  key={article.id} 
                  onClick={() => navigate(`/wiki/${article.slug}`)}
                  className="group cursor-pointer hover:bg-slate-800/50"
                  data-state={selectedIds.includes(article.id) ? "selected" : ""}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.includes(article.id)}
                      onCheckedChange={(checked) => handleSelectRow(article.id, checked)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {article.identifier || "—"}
                  </TableCell>
                  <TableCell className="font-medium text-white group-hover:text-sanctum-gold transition-colors">
                    {article.title}
                  </TableCell>
                  <TableCell>
                    {getCategoryBadge(article.category)}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">
                    {article.version}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {article.author_name || "Unknown"}
                  </TableCell>
                  <TableCell className="text-right text-slate-500 text-xs">
                    {new Date(article.updated_at || article.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {articles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No articles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </Layout>
  );
}
