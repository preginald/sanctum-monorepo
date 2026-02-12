import React, { useState, useEffect } from 'react';
import { Search, Plus, Check, Sparkles } from 'lucide-react';

export default function SearchableSelect({ 
    items = [], 
    onSelect, 
    selectedIds = [], 
    placeholder = "Search...", 
    labelKey = "name",   
    subLabelKey = "website", 
    valueKey = "id",      
    icon: Icon            
}) {
    const [query, setQuery] = useState('');
    const [filtered, setFiltered] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const q = query.toLowerCase().trim();
        
        if (!q) {
            // SUGGESTIONS: Show top 3 'popular' items when input is blank
            const suggestions = items
                .filter(item => Array.isArray(item.tags) && item.tags.includes('popular'))
                .slice(0, 3);
            setFiltered(suggestions); 
            setActiveIndex(0);
            return;
        }

        const results = items
            .filter(item => {
                const label = String(item[labelKey] || '').toLowerCase();
                const sub = String(item[subLabelKey] || '').toLowerCase();
                const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
                return label.includes(q) || sub.includes(q) || tags.includes(q);
            })
            .sort((a, b) => {
                const aLabel = String(a[labelKey] || '').toLowerCase();
                const bLabel = String(b[labelKey] || '').toLowerCase();
                const aStarts = aLabel.startsWith(q);
                const bStarts = bLabel.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return aLabel.localeCompare(bLabel);
            });

        setFiltered(results);
        setActiveIndex(0);
    }, [query, items, labelKey, subLabelKey]);

    const handleSelect = (item) => {
        if (!item || selectedIds.includes(item[valueKey])) return;
        onSelect(item);
        setQuery('');
    };

    const handleKeyDown = (e) => {
        if (filtered.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(filtered[activeIndex]);
        }
    };

    return (
        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
            {/* SEARCH INPUT */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                <input 
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sanctum-gold transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-sanctum-gold/20"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {/* RESULTS LIST */}
            <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {!query && filtered.length > 0 && (
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        <Sparkles size={10} className="text-sanctum-gold" /> Suggested
                    </div>
                )}

                {filtered.length > 0 ? (
                    filtered.map((item, index) => {
                        const isSelected = selectedIds.includes(item[valueKey]);
                        const isHighlighted = index === activeIndex;
                        
                        return (
                            <button 
                                key={item[valueKey]} 
                                onClick={() => handleSelect(item)}
                                disabled={isSelected}
                                className={`w-full text-left flex items-center justify-between p-2 rounded transition-all duration-150 border ${
                                    isHighlighted 
                                        ? 'bg-sanctum-gold/10 border-sanctum-gold/40 shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                                        : 'bg-transparent border-transparent hover:bg-white/5'
                                } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {Icon && <Icon size={14} className={isHighlighted ? "text-sanctum-gold animate-pulse" : "text-slate-500"} />}
                                    
                                    {item[subLabelKey] && (
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 transition-colors ${
                                            isHighlighted ? 'bg-sanctum-gold/20 text-sanctum-gold' : 'bg-slate-900/50 text-slate-400 border border-slate-700'
                                        }`}>
                                            {item[subLabelKey].replace('https://', '').replace('www.', '')}
                                        </span>
                                    )}
                                    
                                    <span className={`text-xs truncate font-medium transition-colors ${isHighlighted ? 'text-white' : 'text-slate-300'}`}>
                                        {item[labelKey]}
                                    </span>
                                </div>

                                {isSelected ? (
                                    <span className="text-[10px] text-green-500 font-bold flex items-center gap-1 flex-shrink-0">
                                        <Check size={10} /> LINKED
                                    </span>
                                ) : (
                                    <Plus size={12} className={`text-sanctum-gold transition-all duration-200 flex-shrink-0 ${isHighlighted ? 'opacity-100 scale-110' : 'opacity-0 scale-100 group-hover:opacity-100'}`} />
                                )}
                            </button>
                        );
                    })
                ) : query.length > 0 ? (
                    <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-dashed border-slate-800">
                        <p className="text-[10px] text-slate-500 italic">No matches found for "{query}"</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}