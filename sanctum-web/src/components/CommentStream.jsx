import React, { useEffect, useState } from 'react';
import { Send, User, Clock, MessageSquare, Lock, Globe, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import SanctumMarkdown from './ui/SanctumMarkdown';
import useAuthStore from '../store/authStore';
import { handleSmartWrap } from '../lib/textUtils';

export default function CommentStream({ resourceType, resourceId, onPromote, highlightId, refreshKey = 0 }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [newBody, setNewBody] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { if (resourceId) fetchComments(); }, [resourceId, resourceType, refreshKey]);

  const fetchComments = async () => {
    try {
      // e.g. /comments?ticket_id=123
      const param = `${resourceType}_id`; 
      const res = await api.get(`/comments?${param}=${resourceId}`);
      setComments(res.data);
    } catch (e) { console.error("Failed to load comments", e); } 
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newBody.trim()) return;
    setSending(true);
    try {
      await api.post('/comments', { 
        body: newBody, 
        visibility: visibility, 
        [`${resourceType}_id`]: resourceId 
      });
      setNewBody('');
      fetchComments(); 
    } catch (e) { alert("Failed to send."); } 
    finally { setSending(false); }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <MessageSquare size={16} /> Activity Stream
        </h3>
      </div>

      {/* INPUT AREA (At Top) */}
      <div className="p-4 bg-slate-800/30 border-b border-slate-700">
        <form onSubmit={handleSubmit} className="space-y-2">
            <textarea 
                className="w-full bg-black/40 border border-slate-600 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-sanctum-gold transition-colors resize-none custom-scrollbar"
                rows="3"
                placeholder={`Log ${visibility} activity... (Markdown supported)`}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={(e) => {
                    handleSmartWrap(e, newBody, setNewBody);
                    if (e.key === 'Enter' && e.metaKey) handleSubmit(e); 
                }}
            />
            
            <div className="flex justify-between items-center">
                <div className="text-[10px] text-slate-600 px-1">Supports Markdown • Cmd+Enter</div>
                <div className="flex items-center gap-2">
                    {/* VISIBILITY TOGGLE */}
                    <button
                        type="button"
                        onClick={() => setVisibility(v => v === 'internal' ? 'public' : 'internal')}
                        className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${visibility === 'internal' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                        title={`Switch to ${visibility === 'internal' ? 'Public' : 'Internal'}`}
                    >
                        {visibility === 'internal' ? <Lock size={12}/> : <Globe size={12}/>}
                        {visibility === 'internal' ? 'Internal' : 'Public'}
                    </button>

                    <button type="submit" disabled={sending || !newBody.trim()} className="px-4 py-1.5 bg-sanctum-gold hover:bg-yellow-500 text-slate-900 font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                        <Send size={14} /> Send
                    </button>
                </div>
            </div>
        </form>
      </div>

      {/* STREAM LIST */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {loading ? (
            <div className="text-center opacity-30 text-sm">Loading...</div>
        ) : comments.length === 0 ? (
            <div className="text-center opacity-30 text-sm italic py-10">No activity recorded.</div>
        ) : (
            comments.map((c) => {
                const isSolution = highlightId === c.id;
                return (
                <div key={c.id} className={`group ${isSolution ? 'relative' : ''}`}>
                    {/* Solution Indicator */}
                    {isSolution && <div className="absolute -left-3 top-2 w-1 h-8 bg-green-500 rounded-r-md shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>}

                    {/* META ROW */}
                    <div className="flex items-center gap-3 mb-2 pl-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${c.visibility === 'public' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 'bg-purple-900/20 text-purple-400 border-purple-500/30'}`}>
                            {c.author_name ? c.author_name.charAt(0).toUpperCase() : <User size={12}/>}
                        </div>
                        <span className="font-bold text-sm text-white">{c.author_name || 'Unknown'}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={10} /> {formatDate(c.created_at)}</span>
                        
                        {isSolution && <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-green-900/40 text-green-400 border border-green-500/30 flex items-center gap-1 mr-2"><CheckCircle size={10} /> Solution</span>}
                        
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ml-auto ${c.visibility === 'public' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'bg-purple-600/10 text-purple-400 border border-purple-500/20'}`}>
                            {c.visibility === 'public' ? 'Public' : 'Internal'}
                        </span>
                        
                        {/* Pin Button */}
                        {onPromote && !isSolution && (
                            <button onClick={() => onPromote(c.body, c.id)} className="ml-2 p-1 text-slate-500 hover:text-green-400 transition-colors" title="Pin as Resolution">
                                <CheckCircle size={14} />
                            </button>
                        )}
                    </div>
                    
                    {/* BODY */}
                    <div className={`text-sm text-slate-300 bg-black/20 p-3 rounded-lg border ${isSolution ? 'border-green-500/30 bg-green-900/5' : (c.visibility === 'public' ? 'border-blue-500/10' : 'border-purple-500/10')} group-hover:border-white/10 transition-colors`}>
                        <SanctumMarkdown content={c.body} className="prose-sm" />
                    </div>
                </div>
                );
            })
        )}
      </div>
    </div>
  );
}