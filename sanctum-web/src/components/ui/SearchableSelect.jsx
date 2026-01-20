import React, { useState, useEffect } from 'react';
import { Search, Plus, Check } from 'lucide-react';

export default function SearchableSelect({ 
    items = [], 
    onSelect, 
    selectedIds = [], 
    placeholder = "Search...", 
    labelKey = "title",   // Key for main text (e.g. 'name', 'title')
    subLabelKey = "identifier", // Key for secondary text (e.g. 'ip_address', 'unit_price')
    valueKey = "id",      // Key for ID
    icon: Icon            // Optional Icon component
}) {
    const [query, setQuery] = useState('');
    const [filtered, setFiltered] = useState([]);

    // Filter logic
    useEffect(() => {
        const q = query.toLowerCase();
        const results = items.filter(item => {
            const label = String(item[labelKey] || '').toLowerCase();
            const sub = String(item[subLabelKey] || '').toLowerCase();
            return label.includes(q) || sub.includes(q);
        }).slice(0, 5); // Limit results
        setFiltered(results);
    }, [query, items, labelKey, subLabelKey]);

    return (
        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
            {/* SEARCH INPUT */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                <input 
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-sanctum-gold transition-colors placeholder:text-slate-600"
                    placeholder={placeholder}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            {/* RESULTS LIST */}
            <div className="space-y-1">
                {filtered.length > 0 ? filtered.map(item => {
                    const isSelected = selectedIds.includes(item[valueKey]);
                    
                    return (
                        <button 
                            key={item[valueKey]} 
                            onClick={() => onSelect(item)}
                            disabled={isSelected}
                            className="w-full text-left flex items-center justify-between p-2 hover:bg-white/5 rounded group disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {Icon && <Icon size={14} className="text-slate-500" />}
                                
                                {item[subLabelKey] && (
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                                        {item[subLabelKey]}
                                    </span>
                                )}
                                
                                <span className="text-xs text-slate-300 truncate font-medium">
                                    {item[labelKey]}
                                </span>
                            </div>

                            {isSelected ? (
                                <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                                    <Check size={10} /> LINKED
                                </span>
                            ) : (
                                <Plus size={12} className="text-sanctum-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </button>
                    );
                }) : (
                    <div className="text-center p-2">
                        <p className="text-[10px] text-slate-600 italic">No matches found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}