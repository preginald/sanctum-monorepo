import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Server, Laptop, Router, Printer, Key, Box, Plus, Trash2, Edit2, 
    Globe, Cloud, Layers, Calendar, Receipt, RefreshCw 
} from 'lucide-react';

export default function AssetList({ assets, onAdd, onEdit, onDelete, onRenew }) {
  const navigate = useNavigate();
  
  const getIcon = (type) => {
      if (!type) return <Box size={16} className="text-slate-400" />;
      
      const t = type.toLowerCase();
      if (t.includes('domain')) return <Globe size={16} className="text-purple-400" />;
      if (t.includes('hosting')) return <Cloud size={16} className="text-sky-400" />;
      if (t.includes('saas')) return <Layers size={16} className="text-pink-400" />;
      
      switch(t) {
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

  const getExpiryStatus = (dateString) => {
      if (!dateString) return null;
      const days = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
      
      if (days < 0) return { color: 'text-red-500 font-bold', label: 'EXPIRED' };
      if (days < 30) return { color: 'text-red-400', label: `Exp: ${days} days` };
      if (days < 60) return { color: 'text-yellow-400', label: `Exp: ${days} days` };
      return { color: 'text-green-400', label: `Exp: ${dateString}` }; // Or just date
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
            {assets.length > 0 ? assets.map(a => {
                const expiry = getExpiryStatus(a.expires_at);
                const isDigital = a.expires_at || a.vendor; 

                return (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-cyan-500/30 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800 rounded">{getIcon(a.asset_type)}</div>
                            <div>
                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                    <button onClick={() => navigate(`/assets/${a.id}`)} className="hover:text-sanctum-gold transition-colors text-left">{a.name}</button>
                                    {/* Auto-Invoice Badge */}
                                    {a.auto_invoice && (
                                        <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1" title="Auto-Billing Active">
                                            <Receipt size={8} /> BILL
                                        </span>
                                    )}
                                </div>
                                
                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-3 mt-0.5">
                                    <span className="uppercase">{a.asset_type}</span>
                                    
                                    {/* RENDER DIFFERENTLY BASED ON TYPE */}
                                    {isDigital ? (
                                        <>
                                            {expiry && (
                                                <span className={`flex items-center gap-1 ${expiry.color}`}>
                                                    <Calendar size={10} /> {expiry.label}
                                                </span>
                                            )}
                                            {a.vendor && <span>via {a.vendor}</span>}
                                        </>
                                    ) : (
                                        <>
                                            {a.ip_address && <span>{a.ip_address}</span>}
                                            {a.serial_number && <span>SN: {a.serial_number}</span>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${a.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                                {a.status}
                            </span>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {a.expires_at && onRenew && (
                                    <button onClick={() => onRenew(a)} className="p-1 text-slate-500 hover:text-indigo-400" title="Renew Asset"><RefreshCw size={14}/></button>
                                )}
                                <button onClick={() => onEdit(a)} className="p-1 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                                <button onClick={() => onDelete(a.id)} className="p-1 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    </div>
                );
            }) : (
                <p className="text-sm opacity-30 italic">No assets deployed.</p>
            )}
        </div>
    </div>
  );
}