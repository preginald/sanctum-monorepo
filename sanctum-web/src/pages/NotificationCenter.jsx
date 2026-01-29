import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, Check, Filter, Clock, Mail, AlertTriangle, Info } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';

export default function NotificationCenter() {
  const { addToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => { fetchNotes(); }, [filter]);

  const fetchNotes = async () => {
      setLoading(true);
      try {
          // We might need to update the API to support 'unread_only' properly based on previous router code
          const endpoint = filter === 'unread' ? '/notifications?unread_only=true&limit=50' : '/notifications?limit=50';
          const res = await api.get(endpoint);
          setNotes(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
  };

  const markRead = async (id) => {
      try {
          await api.put(`/notifications/${id}/read`);
          setNotes(notes.map(n => n.id === id ? { ...n, is_read: true } : n));
      } catch(e) { addToast("Failed to update", "error"); }
  };

  const markAllRead = async () => {
      try {
          await api.put('/notifications/read-all');
          setNotes(notes.map(n => ({ ...n, is_read: true })));
          addToast("All marked as read", "success");
      } catch(e) { addToast("Failed", "error"); }
  };

  const getPriorityIcon = (p) => {
      if (p === 'critical') return <AlertTriangle size={16} className="text-red-500" />;
      if (p === 'high') return <AlertTriangle size={16} className="text-orange-500" />;
      return <Info size={16} className="text-blue-500" />;
  };

  const getStatusBadge = (n) => {
      if (n.status === 'sent') return <Badge variant="success" icon={Mail}>Sent</Badge>;
      if (n.status === 'batched') return <Badge variant="purple" icon={Clock}>Batched</Badge>;
      if (n.status === 'pending') return <Badge variant="warning" icon={Clock}>Pending</Badge>;
      return <Badge variant="default">{n.status}</Badge>;
  };

  return (
    <Layout title="Notification Center">
        <div className="flex justify-between items-center mb-6">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button 
                    onClick={() => setFilter('all')} 
                    className={`px-4 py-2 rounded text-sm font-bold transition-all ${filter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                    All History
                </button>
                <button 
                    onClick={() => setFilter('unread')} 
                    className={`px-4 py-2 rounded text-sm font-bold transition-all ${filter === 'unread' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                    Unread Only
                </button>
            </div>

            <button onClick={markAllRead} className="flex items-center gap-2 text-sm text-blue-400 hover:text-white transition-colors">
                <Check size={16} /> Mark all read
            </button>
        </div>

        {loading ? <Loader2 className="animate-spin mx-auto mt-12" /> : (
            <div className="space-y-4">
                {notes.map(n => (
                    <div 
                        key={n.id} 
                        className={`
                            p-4 rounded-xl border transition-all flex items-start gap-4 relative group
                            ${n.is_read ? 'bg-slate-900 border-slate-800 opacity-75' : 'bg-slate-800 border-slate-600 shadow-lg'}
                        `}
                    >
                        <div className="pt-1">{getPriorityIcon(n.priority)}</div>
                        
                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h4 className={`text-sm font-bold ${n.is_read ? 'text-slate-300' : 'text-white'}`}>{n.title}</h4>
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(n)}
                                    <span className="text-[10px] font-mono text-slate-500">
                                        {new Date(n.created_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-400 mt-1">{n.message}</p>
                            
                            <div className="flex gap-4 mt-3">
                                {n.link && (
                                    <a href={n.link} className="text-xs text-sanctum-gold hover:underline font-bold">
                                        View Resource &rarr;
                                    </a>
                                )}
                                {!n.is_read && (
                                    <button onClick={() => markRead(n.id)} className="text-xs text-slate-500 hover:text-white">
                                        Mark as Read
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {notes.length === 0 && (
                    <div className="text-center p-12 opacity-30">
                        <div className="inline-block p-4 bg-slate-800 rounded-full mb-4"><Check size={32}/></div>
                        <p>No notifications found.</p>
                    </div>
                )}
            </div>
        )}
    </Layout>
  );
}