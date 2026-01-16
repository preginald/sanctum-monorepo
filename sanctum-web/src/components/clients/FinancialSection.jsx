import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, Briefcase, Plus, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';

export default function FinancialSection({ deals, invoices, projects, isNaked, onAddDeal, onAddProject }) {
  const navigate = useNavigate();

  // If Naked Tech scope, hide financial specifics but maybe show tickets (handled elsewhere)
  if (isNaked) return null;

  return (
    <div className="space-y-6">
        
        {/* DEALS */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
                    <DollarSign size={16} /> Active Pipeline
                </h3>
                <button onClick={onAddDeal} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Plus size={16} /></button>
            </div>
            <div className="space-y-2">
                {deals.map(deal => (
                    <div key={deal.id} onClick={() => navigate(`/deals/${deal.id}`)} className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-sanctum-gold/30 cursor-pointer transition-colors group">
                        <div>
                            <div className="font-bold text-white group-hover:text-sanctum-gold transition-colors">{deal.title}</div>
                            <div className="text-xs opacity-50">{deal.stage} • {deal.probability}%</div>
                        </div>
                        <div className="font-mono text-sanctum-gold">{formatCurrency(deal.amount)}</div>
                    </div>
                ))}
                {deals.length === 0 && <p className="text-sm opacity-30 italic">No active deals.</p>}
            </div>
        </div>

        {/* PROJECTS */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
                    <Briefcase size={16} /> Projects
                </h3>
                <button onClick={onAddProject} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Plus size={16} /></button>
            </div>
            <div className="space-y-2">
                {projects.map(proj => (
                    <div key={proj.id} onClick={() => navigate(`/projects/${proj.id}`)} className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-blue-500/30 cursor-pointer transition-colors group">
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{proj.name}</div>
                        <div className={`text-xs px-2 py-0.5 rounded uppercase font-bold ${proj.status === 'completed' ? 'bg-green-900 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {proj.status}
                        </div>
                    </div>
                ))}
                {projects.length === 0 && <p className="text-sm opacity-30 italic">No projects.</p>}
            </div>
        </div>

        {/* INVOICES */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400 mb-4">
                <FileText size={16} /> Recent Invoices
            </h3>
            <div className="space-y-2">
                {invoices.map(inv => (
                    <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-white/20 cursor-pointer transition-colors">
                        <div>
                            <div className="font-bold text-sm">#{inv.id.slice(0,8)}</div>
                            <div className="text-xs opacity-50">{formatDate(inv.generated_at)}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-white">{formatCurrency(inv.total_amount)}</div>
                            <div className={`text-[10px] uppercase font-bold ${inv.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>{inv.status}</div>
                        </div>
                    </div>
                ))}
                {invoices.length === 0 && <p className="text-sm opacity-30 italic">No invoices found.</p>}
            </div>
        </div>

    </div>
  );
}