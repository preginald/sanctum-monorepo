import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import useAuthStore from '../../store/authStore';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { token } = useAuthStore(); // Re-fetch on token change (login)
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const fetchNotifications = async () => {
      try {
          const res = await api.get('/notifications');
          setNotifications(res.data);
          setUnreadCount(res.data.filter(n => !n.is_read).length);
      } catch(e) { console.error(e); }
  };

  // Poll every 60s
  useEffect(() => {
      if (token) {
          fetchNotifications();
          const interval = setInterval(fetchNotifications, 60000);
          return () => clearInterval(interval);
      }
  }, [token]);

  // Click Outside
  useEffect(() => {
      const handleClickOutside = (event) => {
          if (containerRef.current && !containerRef.current.contains(event.target)) {
              setIsOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRead = async (e, n) => {
      e.stopPropagation();
      try {
          // Optimistic Update
          const updated = notifications.map(x => x.id === n.id ? { ...x, is_read: true } : x);
          setNotifications(updated);
          setUnreadCount(updated.filter(x => !x.is_read).length);
          
          await api.put(`/notifications/${n.id}`, { is_read: true });
      } catch(e) { fetchNotifications(); } // Revert on error
  };

  const handleClear = async () => {
      try {
          setNotifications([]);
          setUnreadCount(0);
          await api.delete('/notifications/clear-all');
      } catch(e) { fetchNotifications(); }
  };

  const handleClick = (n) => {
      if (!n.is_read) handleRead({ stopPropagation: () => {} }, n);
      setIsOpen(false);
      if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={containerRef}>
        {/* BELL ICON */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full relative transition-colors"
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-sanctum-dark animate-pulse"></span>
            )}
        </button>

        {/* DROPDOWN */}
        {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Notifications</h4>
                    {notifications.length > 0 && (
                        <button onClick={handleClear} className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                            <Trash2 size={10} /> Clear All
                        </button>
                    )}
                </div>

                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? notifications.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => handleClick(n)}
                            className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-white/5 transition-colors relative group ${n.is_read ? 'opacity-50' : 'bg-blue-900/10'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-bold ${n.is_read ? 'text-slate-300' : 'text-white'}`}>{n.title}</span>
                                {!n.is_read && (
                                    <button 
                                        onClick={(e) => handleRead(e, n)} 
                                        className="text-blue-500 hover:text-blue-400 p-1"
                                        title="Mark as Read"
                                    >
                                        <Check size={14} />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">{n.message}</p>
                            <span className="text-[10px] text-slate-600 mt-2 block">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-600 text-xs italic">
                            All caught up. No new signals.
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}