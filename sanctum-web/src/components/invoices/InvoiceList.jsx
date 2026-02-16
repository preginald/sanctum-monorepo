import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

// You might need to import these form your lib/formatters
const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '';

export default function InvoiceList({ invoices = [], title = "Recent Invoices", compact = false }) {
    const navigate = useNavigate();

    return (
        <div className={`bg-slate-900 border border-slate-700 rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
            {title && (
                <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400 mb-4">
                    <FileText size={16} /> {title}
                </h3>
            )}
            <div className="space-y-2">
                {invoices.map(inv => (
                    <div 
                        key={inv.id} 
                        onClick={() => navigate(`/invoices/${inv.id}`)} 
                        className="flex justify-between items-center p-3 bg-black/20 rounded border border-white/5 hover:border-white/20 cursor-pointer transition-colors"
                    >
                        <div>
                            <div className="font-bold text-sm">#{String(inv.id).slice(0,8).toUpperCase()}</div>
                            <div className="text-xs opacity-50">{formatDate(inv.generated_at)}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-white">{formatCurrency(inv.total_amount)}</div>
                            <div className={`text-[10px] uppercase font-bold ${inv.status === 'paid' ? 'text-green-500' : 'text-yellow-500'}`}>
                                {inv.status}
                            </div>
                        </div>
                    </div>
                ))}
                {invoices.length === 0 && <p className="text-sm opacity-30 italic">No invoices found.</p>}
            </div>
        </div>
    );
}