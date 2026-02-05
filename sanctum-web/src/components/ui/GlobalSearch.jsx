import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, User, Ticket, BookOpen, Building, Server, PlusCircle, Command } from 'lucide-react';
import api from '../../lib/api';
import useModalStore from '../../store/modalStore';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { openModal } = useModalStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('global'); // global, wiki, ticket, client, etc.
  const [selectedIndex, setSelectedIndex] = useState(-1); // <--- NEW: Track keyboard selection

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const resultListRef = useRef(null); // <--- NEW: Ref for scroll container

  // Keyboard Shortcut (Cmd+K to open)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
          setIsOpen(false);
          inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
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

  // Mode Detection (Visual Only)
  useEffect(() => {
      const q = query.toLowerCase();
      if (q.startsWith('w:') || q.startsWith('wiki')) setMode('wiki');
      else if (q.startsWith('t:') || q.startsWith('tic')) setMode('ticket');
      else if (q.startsWith('c:') || q.startsWith('cli')) setMode('client');
      else if (q.startsWith('u:') || q.startsWith('user')) setMode('contact');
      else if (q.startsWith('a:') || q.startsWith('asset')) setMode('asset');
      else setMode('global');
  }, [query]);

  // Debounced Search
  useEffect(() => {
      const delayDebounceFn = setTimeout(async () => {
          if (query.length > 1) {
              setLoading(true);
              setIsOpen(true);
              setSelectedIndex(-1); // Reset selection on new search
              try {
                  const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
                  setResults(res.data);
                  // Auto-select first result for quicker access? 
                  // setSelectedIndex(0); // Optional: Uncomment to auto-select first
              } catch (e) { console.error(e); }
              finally { setLoading(false); }
          } else {
              setResults([]);
              setIsOpen(false);
          }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultListRef.current) {
      const activeItem = resultListRef.current.children[selectedIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (link) => {
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(-1);

      // INTERCEPTION LOGIC
      if (link === '/tickets/new') {
          openModal('TICKET_CREATE');
          return;
      }
      
    // Default Navigation
    navigate(link);
  };

  // KEYBOARD NAVIGATION HANDLER
  const handleInputKeyDown = (e) => {
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0)); // Cycle to top
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1)); // Cycle to bottom
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex].link);
      } else if (results.length > 0) {
        // Optional: If nothing selected, Enter selects first result
        handleSelect(results[0].link);
      }
    }
  };

  const getResultIcon = (type) => {
      switch(type) {
          case 'client': return <Building size={14} className="text-blue-400"/>;
          case 'ticket': return <Ticket size={14} className="text-sanctum-gold"/>;
          case 'wiki': return <BookOpen size={14} className="text-purple-400"/>;
          case 'contact': return <User size={14} className="text-green-400"/>;
          case 'asset': return <Server size={14} className="text-cyan-400"/>;
          case 'action': return <PlusCircle size={14} className="text-emerald-400"/>;
          default: return <Search size={14}/>;
      }
  };

  const getSearchIcon = () => {
      if (loading) return <Loader2 className="animate-spin text-slate-500" size={16} />;
      switch(mode) {
          case 'wiki': return <BookOpen className="text-purple-400 animate-in zoom-in duration-200" size={16} />;
          case 'ticket': return <Ticket className="text-sanctum-gold animate-in zoom-in duration-200" size={16} />;
          case 'client': return <Building className="text-blue-400 animate-in zoom-in duration-200" size={16} />;
          case 'contact': return <User className="text-green-400 animate-in zoom-in duration-200" size={16} />;
          case 'asset': return <Server className="text-cyan-400 animate-in zoom-in duration-200" size={16} />;
          default: return <Search className="text-slate-500" size={16} />;
      }
  };

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <div className="relative group">
          <div className="absolute left-3 top-2.5 transition-colors">
              {getSearchIcon()}
          </div>
          
          <input 
            ref={inputRef}
            id="global-search-input"
            type="text" 
            placeholder="Search... (Cmd+K)" 
            className={`w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none transition-all ${mode !== 'global' ? 'border-opacity-100' : ''}`}
            style={{
                borderColor: mode === 'wiki' ? '#a855f7' : 
                             mode === 'ticket' ? '#d4af37' : 
                             mode === 'client' ? '#60a5fa' : 
                             mode === 'asset' ? '#22d3ee' : ''
            }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown} // <--- ATTACHED HANDLER
            onFocus={() => { if(query.length > 1) setIsOpen(true); }}
            autoComplete="off"
          />
          
          {!loading && !query && (
              <div className="absolute right-3 top-2.5 pointer-events-none opacity-50">
                  <Command size={14} className="text-slate-400"/> 
              </div>
          )}
      </div>

      {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              <div ref={resultListRef} className="max-h-96 overflow-y-auto custom-scrollbar">
                  {results.map((r, index) => {
                      const isSelected = index === selectedIndex;
                      return (
                        <div 
                          key={`${r.type}-${r.id}`} 
                          onClick={() => handleSelect(r.link)}
                          className={`flex items-center gap-3 p-3 cursor-pointer border-b border-slate-800 last:border-0 transition-colors
                              ${isSelected ? 'bg-slate-800 ring-1 ring-inset ring-sanctum-gold/20' : ''}
                              ${!isSelected && r.type === 'action' ? 'bg-sanctum-gold/10 hover:bg-sanctum-gold/20' : ''}
                              ${!isSelected && r.type !== 'action' ? 'hover:bg-slate-800' : ''}
                          `}
                        >
                            <div className={`p-2 rounded border ${r.type === 'action' ? 'border-sanctum-gold/30 bg-sanctum-gold/10' : 'border-white/5 bg-black/40'}`}>
                                {getResultIcon(r.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-bold text-sm truncate ${r.type === 'action' ? 'text-sanctum-gold' : 'text-white'}`}>
                                    {r.title}
                                </div>
                                {r.subtitle && <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>}
                            </div>
                            
                            {/* Hint for Actions */}
                            {r.type === 'action' && <span className="text-[10px] uppercase font-bold tracking-wider text-sanctum-gold opacity-50 px-2">Run</span>}
                            {/* Hint for Selection */}
                            {isSelected && <span className="text-[10px] text-slate-400 opacity-50 px-2">↵</span>}
                        </div>
                      );
                  })}
              </div>
              <div className="bg-slate-950 p-2 text-[10px] text-center text-slate-600 font-mono border-t border-slate-800">
                  {results.length} result{results.length !== 1 ? 's' : ''} found • {mode.toUpperCase()} MODE
              </div>
          </div>
      )}
      
      {isOpen && query.length > 1 && results.length === 0 && !loading && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-sm text-slate-500 z-50 shadow-xl">
              <p className="mb-1">No results found.</p>
              <p className="text-xs opacity-50">Try searching for Tickets (t:), Wiki (w:), or Clients (c:)</p>
          </div>
      )}
    </div>
  );
}