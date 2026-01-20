import React from 'react';
import { Server, Laptop, Router, Printer, Key, Box, Plus, Trash2, Edit2 } from 'lucide-react';

export default function AssetList({ assets, onAdd, onEdit, onDelete }) {
  
  const getIcon = (type) => {
      switch(type) {
          case 'server': return <Server size={16} className="text-cyan-400" />;
          case 'laptop': 
          case 'workstation': return <Laptop size={16} className="text-blue-400" />;
          case 'network': 
          case 'firewall': return <Router size={16} className="text-purple-400" />;
          case 'printer': return <Printer size={16} className="text-orange-400" />;
          case 'software': 
          case 'license': return <Key size={16} className="text-yellow-400" />;
          default: return <Box size={16} className="text-slate-400" />;
      }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
                <Box size={16} /> Asset Register
            </h3>
            <button onClick={onAdd} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors">
                <Plus size={16} />
            </button>
        </div>

        <div className="space-y-2">
            {assets.length > 0 ? assets.map(a => (
                <div key={a.id} className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-cyan-500/30 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded">{getIcon(a.asset_type)}</div>
                        <div>
                            <div className="font-bold text-white text-sm">{a.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 flex gap-2">
                                {a.ip_address && <span>{a.ip_address}</span>}
                                {a.serial_number && <span>SN: {a.serial_number}</span>}
                                <span className="uppercase">{a.asset_type}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {a.status}
                        </span>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEdit(a)} className="p-1 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                            <button onClick={() => onDelete(a.id)} className="p-1 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                    </div>
                </div>
            )) : (
                <p className="text-sm opacity-30 italic">No assets deployed.</p>
            )}
        </div>
    </div>
  );
}