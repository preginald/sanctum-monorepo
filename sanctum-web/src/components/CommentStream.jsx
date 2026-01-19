import React, { useEffect, useState } from 'react';
import { Send, User, Clock, MessageSquare, Lock, Globe } from 'lucide-react'; // Added Icons
import api from '../lib/api';
import SanctumMarkdown from './ui/SanctumMarkdown';

export default function CommentStream({ resourceType, resourceId }) {
  const [comments, setComments] = useState([]);
  const [newBody, setNewBody] = useState('');
  const [visibility, setVisibility] = useState('internal'); // State for toggle
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (resourceId) fetchComments();
  }, [resourceId, resourceType]);

  const fetchComments = async () => {
    try {
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
      const payload = {
        body: newBody,
        visibility: visibility, // Use state
        [`${resourceType}_id`]: resourceId
      };

      await api.post('/comments', payload);
      setNewBody('');
      fetchComments(); 
    } catch (e) { alert("Failed to send."); } 
    finally { setSending(false); }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString([], { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <MessageSquare size={16} /> Activity Stream
        </h3>
        {/* Simple Legend */}
        <div className="flex gap-2 text-[10px] uppercase font-bold">
            <span className="flex items-center gap-1 text-purple-400"><Lock size={10}/> Internal</span>
            <span className="flex items-center gap-1 text-blue-400"><Globe size={10}/> Public</span>
        </div>
      </div>

      {/* STREAM */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {loading ? (
            <div className="text-center opacity-30 text-sm">Loading...</div>
        ) : comments.length === 0 ? (
            <div className="text-center opacity-30 text-sm italic py-10">No activity recorded.</div>
        ) : (
          comments.map((c) => (
                <div key={c.id} className="group">
                    {/* META HEADER ROW */}
                    <div className="flex items-center gap-3 mb-2 pl-1">
                        {/* Avatar (Inline) */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${c.visibility === 'public' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 'bg-purple-900/20 text-purple-400 border-purple-500/30'}`}>
                            {c.author_name ? c.author_name.charAt(0).toUpperCase() : <User size={12}/>}
                        </div>

                        <span className="font-bold text-sm text-white">{c.author_name || 'Unknown'}</span>
                        
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={10} /> {formatDate(c.created_at)}
                        </span>
                        
                        {/* Visibility Badge */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ml-auto ${c.visibility === 'public' ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'bg-purple-600/10 text-purple-400 border border-purple-500/20'}`}>
                            {c.visibility === 'public' ? 'Public' : 'Internal'}
                        </span>
                    </div>
                    
                    {/* BODY (Full Width) */}
                    <div className={`text-sm text-slate-300 bg-black/20 p-3 rounded-lg border ${c.visibility === 'public' ? 'border-blue-500/10' : 'border-purple-500/10'} group-hover:border-white/10 transition-colors`}>
                        <SanctumMarkdown content={c.body} className="prose-sm" />
                    </div>
                </div>
            ))
        )}
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-slate-800/30 border-t border-slate-700">
        <form onSubmit={handleSubmit} className="relative">
            <textarea 
                className="w-full bg-black/40 border border-slate-600 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-sanctum-gold transition-colors pr-12 resize-none custom-scrollbar"
                rows="3"
                placeholder={`Log ${visibility} activity... (Markdown supported)`}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSubmit(e); }}
            />
            
            {/* CONTROLS */}
            <div className="absolute right-2 bottom-2.5 flex items-center gap-2">
                {/* VISIBILITY TOGGLE */}
                <button
                    type="button"
                    onClick={() => setVisibility(v => v === 'internal' ? 'public' : 'internal')}
                    className={`p-1.5 rounded text-xs font-bold flex items-center gap-1 transition-all ${visibility === 'internal' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                    title={`Click to switch to ${visibility === 'internal' ? 'Public' : 'Internal'}`}
                >
                    {visibility === 'internal' ? <Lock size={12}/> : <Globe size={12}/>}
                </button>

                <button 
                    type="submit" 
                    disabled={sending || !newBody.trim()}
                    className="p-1.5 bg-sanctum-gold hover:bg-yellow-500 text-slate-900 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Send"
                >
                    <Send size={16} />
                </button>
            </div>
        </form>
        <div className="text-[10px] text-slate-600 mt-2 flex justify-between px-1">
            <span>Supports Markdown</span>
            <span className={visibility === 'internal' ? 'text-purple-500' : 'text-blue-500'}>
                Posting as {visibility.toUpperCase()}
            </span>
        </div>
      </div>

    </div>
  );
}