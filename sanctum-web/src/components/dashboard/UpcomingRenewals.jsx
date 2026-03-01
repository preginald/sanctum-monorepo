import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

export default function UpcomingRenewals() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/assets/lifecycle/expiring?days=30')
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getDaysColor = (days) => {
        if (days <= 0) return 'text-red-500 font-bold';
        if (days <= 7) return 'text-red-400 font-bold';
        if (days <= 30) return 'text-orange-400';
        return 'text-green-400';
    };

    const getInvoiceStatus = (asset) => {
        const days = asset.days_until_expiry;
        if (asset.pending_renewal_invoice_id) {
            if (days <= 7) return (
                <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                    <AlertTriangle size={12} /> Escalation
                </span>
            );
            return (
                <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${asset.pending_renewal_invoice_id}`); }}
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                >
                    <CheckCircle size={12} /> Invoice Sent <ExternalLink size={10} />
                </button>
            );
        }
        if (!asset.auto_invoice) return <span className="text-slate-500 text-xs">Manual</span>;
        return <span className="text-slate-400 text-xs flex items-center gap-1"><Clock size={12} /> Pending</span>;
    };

    if (loading) return null;
    if (!data || data.assets.length === 0) return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                <RefreshCw size={14} /> Upcoming Renewals
            </h3>
            <p className="text-slate-500 text-sm">No upcoming renewals.</p>
        </div>
    );

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <RefreshCw size={14} /> Upcoming Renewals
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                    {data.expiring_count > 0 && (
                        <span className="text-orange-400">{data.expiring_count} expiring</span>
                    )}
                    {data.expired_count > 0 && (
                        <span className="text-red-400 font-bold">{data.expired_count} expired</span>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-700/50">
                            <th className="text-left pb-2 font-medium">Asset</th>
                            <th className="text-left pb-2 font-medium">Client</th>
                            <th className="text-left pb-2 font-medium">Expires</th>
                            <th className="text-left pb-2 font-medium">Days Left</th>
                            <th className="text-left pb-2 font-medium">Invoice</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {data.assets.map(a => (
                            <tr key={a.id} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="py-2.5 pr-4">
                                    <button
                                        onClick={() => navigate(`/assets/${a.id}`)}
                                        className="text-white hover:text-indigo-400 transition-colors font-medium text-left flex items-center gap-1.5"
                                    >
                                        {a.name}
                                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                    </button>
                                    <span className="text-[10px] text-slate-500 uppercase">{a.asset_type}</span>
                                </td>
                                <td className="py-2.5 pr-4">
                                    <button
                                        onClick={() => navigate(`/clients/${a.account_id}`)}
                                        className="text-slate-300 hover:text-white transition-colors text-left"
                                    >
                                        {a.account_name}
                                    </button>
                                </td>
                                <td className="py-2.5 pr-4 text-slate-400 text-xs">
                                    {new Date(a.expires_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="py-2.5 pr-4">
                                    <span className={`text-xs font-mono ${getDaysColor(a.days_until_expiry)}`}>
                                        {a.days_until_expiry <= 0 ? 'EXPIRED' : `${a.days_until_expiry}d`}
                                    </span>
                                </td>
                                <td className="py-2.5">
                                    {getInvoiceStatus(a)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
