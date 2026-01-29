import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Poll for notifications every 60 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCount = async () => {
      try {
          const res = await api.get('/notifications/count');
          setUnreadCount(res.data.count);
      } catch (e) { console.error("Poll failed", e); }
  };

  const fetchNotifications = async () => {
      try {
          const res = await api.get('/notifications?limit=10');
          setNotifications(res.data);
      } catch (e) { console.error(e); }
  };

  const toggleOpen = () => {
      if (!isOpen) {
          fetchNotifications();
          setIsOpen(true);
      } else {
          setIsOpen(false);
      }
  };

  const handleRead = async (e, id) => {
      e.stopPropagation();
      try {
          await api.put(`/notifications/${id}/read`);
          setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
          setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {}
  };

  const handleReadAll = async () => {
      try {
          await api.put('/notifications/read-all');
          setNotifications(notifications.map(n => ({ ...n, is_read: true })));
          setUnreadCount(0);
      } catch (e) {}
  };

  const handleNavigate = async (n) => {
      if (!n.is_read) await handleRead({ stopPropagation: () => {} }, n.id);
      setIsOpen(false);
      if (n.link) navigate(n.link);
  };

  const getPriorityColor = (p) => {
      if (p === 'critical') return 'bg-red-500';
      if (p === 'high') return 'bg-orange-500';
      return 'bg-blue-500';
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={toggleOpen}
        className="relative p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900" />
        )}
      </button>

      {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-black/20">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Notifications</h3>
                  {unreadCount > 0 && (
                      <button onClick={handleReadAll} className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1">
                          <Check size={10} /> Mark all read
                      </button>
                  )}
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNavigate(n)}
                        className={`p-3 border-b border-slate-800 last:border-0 hover:bg-white/5 cursor-pointer transition-colors relative group ${n.is_read ? 'opacity-50' : 'opacity-100'}`}
                      >
                          <div className="flex items-start gap-3">
                              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(n.priority)}`} />
                              <div className="flex-1">
                                  <h4 className="text-sm font-bold text-white leading-tight mb-1">{n.title}</h4>
                                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                  <div className="flex justify-between items-center mt-2">
                                      <span className="text-[10px] text-slate-600 font-mono">
                                          {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                      {!n.is_read && (
                                          <button 
                                            onClick={(e) => handleRead(e, n.id)}
                                            className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500"
                                          >
                                              Dismiss
                                          </button>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )) : (
                      <div className="p-8 text-center text-slate-600 text-xs italic">
                          All caught up. No new alerts.
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
}