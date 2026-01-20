import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, User, Ticket, BookOpen, Building, Server } from 'lucide-react';
import api from '../../lib/api';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Keyboard Shortcut (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'Escape') {
          setIsOpen(false);
          document.getElementById('global-search-input')?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Debounced Search
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
          if (query.length > 1) {
              setLoading(true);
              setIsOpen(true);
              try {
                  const res = await api.get(`/search?q=${query}`);
                  setResults(res.data);
              } catch (e) { console.error(e); }
              finally { setLoading(false); }
          } else {
              setResults([]);
              setIsOpen(false);
          }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (link) => {
      setIsOpen(false);
      setQuery('');
      navigate(link);
  };

  const getIcon = (type) => {
      switch(type) {
          case 'client': return <Building size={14} className="text-blue-400"/>;
          case 'ticket': return <Ticket size={14} className="text-sanctum-gold"/>;
          case 'wiki': return <BookOpen size={14} className="text-purple-400"/>;
          case 'contact': return <User size={14} className="text-green-400"/>;
          case 'asset': return <Server size={14} className="text-cyan-400"/>; // NEW
          default: return <Search size={14}/>;
      }
  };

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input 
            id="global-search-input"
            type="text" 
            placeholder="Search... (Cmd+K)" 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-sanctum-gold transition-colors"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if(query.length > 1) setIsOpen(true); }}
          />
          {loading && <div className="absolute right-3 top-2.5"><Loader2 className="animate-spin text-slate-500" size={16} /></div>}
      </div>

      {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="max-h-96 overflow-y-auto">
                  {results.map((r, i) => (
                      <div 
                        key={`${r.type}-${r.id}`} 
                        onClick={() => handleSelect(r.link)}
                        className="flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800 last:border-0"
                      >
                          <div className="p-2 bg-black/40 rounded border border-white/5">{getIcon(r.type)}</div>
                          <div>
                              <div className="font-bold text-sm text-white">{r.title}</div>
                              {r.subtitle && <div className="text-xs text-slate-500">{r.subtitle}</div>}
                          </div>
                      </div>
                  ))}
              </div>
              <div className="bg-slate-950 p-2 text-[10px] text-center text-slate-600 font-mono">
                  {results.length} results found
              </div>
          </div>
      )}
      
      {isOpen && query.length > 1 && results.length === 0 && !loading && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-sm text-slate-500 z-50">
              No results found.
          </div>
      )}
    </div>
  );
}
