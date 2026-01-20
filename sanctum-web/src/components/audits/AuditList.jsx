import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Plus } from 'lucide-react';

export default function AuditList({ audits, onAdd }) {
  const navigate = useNavigate();

  const getScoreColor = (score) => {
      if (score >= 80) return 'text-green-400';
      if (score >= 50) return 'text-yellow-400';
      return 'text-red-400';
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
                <Activity size={16} /> Audit History
            </h3>
            {onAdd && (
                <button 
                    onClick={onAdd} 
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                    title="New Audit"
                >
                    <Plus size={16} />
                </button>
            )}
        </div>
        <div className="space-y-2">
            {audits.length > 0 ? audits.map(a => (
                <div 
                    key={a.id} 
                    onClick={() => navigate(`/audit/${a.id}`)} 
                    className="flex justify-between p-3 bg-black/20 rounded border border-white/5 hover:border-white/20 cursor-pointer transition-colors group"
                >
                    <div>
                        <span className="font-bold text-white block">Security Audit</span>
                        <span className="text-xs opacity-50">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-col items-end justify-center">
                         <span className="text-[10px] uppercase font-bold text-slate-600">Score</span>
                         <span className={`font-mono font-bold ${getScoreColor(a.security_score)}`}>
                             {a.security_score}
                         </span>
                    </div>
                </div>
            )) : (
                <p className="text-sm opacity-30 italic p-2">No audits performed.</p>
            )}
        </div>
    </div>
  );
}