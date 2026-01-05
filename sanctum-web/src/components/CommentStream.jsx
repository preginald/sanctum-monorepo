import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Lock, Globe } from 'lucide-react';
import api from '../lib/api';

export default function CommentStream({ resourceType, resourceId }) {
  const [comments, setComments] = useState([]);
  const [newBody, setNewBody] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [resourceType, resourceId]);

  const fetchComments = async () => {
    try {
      const param = `${resourceType}_id`;
      const res = await api.get(`/comments?${param}=${resourceId}`);
      setComments(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!newBody.trim()) return;

    try {
      const payload = {
        body: newBody,
        visibility: visibility,
      };
      payload[`${resourceType}_id`] = resourceId;

      await api.post('/comments', payload);
      setNewBody('');
      fetchComments();
    } catch (e) { alert("Failed to post comment"); }
  };

  return (
    <div className="flex flex-col h-full bg-black/20 rounded-xl border border-white/5 overflow-hidden">
      <div className="p-3 border-b border-white/5 bg-white/5 flex items-center gap-2">
        <MessageSquare size={16} className="opacity-50" />
        <span className="text-xs font-bold uppercase tracking-widest opacity-70">Activity Stream</span>
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
        {comments.length === 0 && <p className="text-center opacity-30 text-xs italic">No activity yet.</p>}
        {comments.map(c => (
          <div key={c.id} className={`p-3 rounded-lg border ${c.visibility === 'internal' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-900/10 border-blue-500/30'}`}>
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-xs text-sanctum-gold">{c.author_name}</span>
              <div className="flex items-center gap-2">
                {/* VISIBILITY BADGE */}
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${c.visibility === 'internal' ? 'bg-slate-700 text-slate-300' : 'bg-blue-600 text-white'}`}>
                  {c.visibility === 'internal' ? <Lock size={8} /> : <Globe size={8} />}
                  {c.visibility === 'internal' ? 'INTERNAL' : 'PUBLIC CLIENT'}
                </span>
                <span className="text-[10px] opacity-40">
                  {new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {/* INPUT */}
      <form onSubmit={postComment} className="p-3 border-t border-white/5 bg-white/5">
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setVisibility('internal')} className={`px-3 py-1 text-[10px] rounded uppercase font-bold transition-colors ${visibility === 'internal' ? 'bg-slate-600 text-white' : 'opacity-50 hover:bg-white/10'}`}>Internal Note</button>
          <button type="button" onClick={() => setVisibility('public')} className={`px-3 py-1 text-[10px] rounded uppercase font-bold transition-colors ${visibility === 'public' ? 'bg-blue-600 text-white' : 'opacity-50 hover:bg-white/10'}`}>Public Reply</button>
        </div>
        <div className="flex gap-2">
          <input 
            className="flex-1 bg-transparent border border-white/10 rounded p-2 text-sm outline-none focus:border-sanctum-gold text-white placeholder-gray-600" 
            placeholder={visibility === 'internal' ? "Add an internal note..." : "Reply to client..."}
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
          />
          <button type="submit" className="p-2 rounded bg-sanctum-gold text-black hover:bg-yellow-500">
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}