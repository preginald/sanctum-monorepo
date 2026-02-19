import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'; from '../components/Layout';
import api from '../lib/api';
import { Loader2, AlertTriangle, Send, ExternalLink, DollarSign, Clock } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function UnpaidInvoices() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(null);

  useEffect(() => { fetchUnpaid(); }, []);

  const fetchUnpaid = async () => {
    try {
      const res = await api.get('/invoices/unpaid');
      setData(res.data);
    } catch (e) {
      console.error(e);
      addToast("Failed to load invoices", "danger");
    } finally { setLoading(false); }
  };

  const handleSendReminder = async (inv) => {
    if (!inv.billing_email) {
      addToast("No billing email set for this client", "danger");
      return;
    }
    setSendingReminder(inv.id);
    try {
      await api.post(`/invoices/${inv.id}/send`, {
        to_email: inv.billing_email,
        cc_emails: [],
        subject: `Friendly Reminder: Invoice #${inv.id.slice(0, 8).toUpperCase()} Outstanding`,
        message: "We hope this finds you well. This is a friendly reminder that the attached invoice remains outstanding. Please let us know if you have any questions."
      });
      addToast(`Reminder sent to ${inv.billing_email}`, "success");
      fetchUnpaid();
    } catch (e) {
      addToast("Failed to send reminder", "danger");
    } finally { setSendingReminder(null); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU') : '—';

  if (loading) return <Layout title="Unpaid Invoices"><Loader2 className="animate-spin" /></Layout>;

  const { total_count, total_outstanding, overdue_count, invoices } = data || { total_count: 0, total_outstanding: 0, overdue_count: 0, invoices: [] };

  return (
    <Layout title="Unpaid Invoices">
      
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <DollarSign size={20} className="text-sanctum-gold" />
            <div>
              <p className="text-xs uppercase opacity-50">Total Outstanding</p>
              <p className="text-2xl font-bold text-sanctum-gold">{formatCurrency(total_outstanding)}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-blue-400" />
            <div>
              <p className="text-xs uppercase opacity-50">Unpaid Invoices</p>
              <p className="text-2xl font-bold">{total_count}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-400" />
            <div>
              <p className="text-xs uppercase opacity-50">Overdue</p>
              <p className="text-2xl font-bold text-red-400">{overdue_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* INVOICE TABLE */}
      {invoices.length === 0 ? (
        <div className="text-center py-16 opacity-50">
          <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-bold">All clear — no unpaid invoices.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-slate-700 text-xs uppercase tracking-widest opacity-50">
                <TableHead className="text-left p-4">Client</TableHead>
                <TableHead className="text-right p-4">Amount</TableHead>
                <TableHead className="text-left p-4">Issued</TableHead>
                <TableHead className="text-left p-4">Due</TableHead>
                <TableHead className="text-left p-4">Status</TableHead>
                <TableHead className="text-right p-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow 
                  key={inv.id} 
                  className={`border-b border-slate-800 hover:bg-white/5 transition-colors ${inv.is_overdue ? 'bg-red-500/5' : ''}`}
                >
                  <TableCell className="p-4">
                    <button 
                      onClick={() => navigate(`/clients/${inv.account_id}`)}
                      className="font-bold hover:text-sanctum-gold transition-colors text-left"
                    >
                      {inv.account_name}
                    </button>
                    <div className="text-xs opacity-50 font-mono">#{inv.id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell className="p-4 text-right font-mono font-bold">{formatCurrency(inv.total_amount)}</TableCell>
                  <TableCell className="p-4 text-xs opacity-70">{formatDate(inv.generated_at)}</TableCell>
                  <TableCell className="p-4">
                    <span className={`text-xs font-bold ${inv.is_overdue ? 'text-red-400' : 'opacity-70'}`}>
                      {formatDate(inv.due_date)}
                    </span>
                  </TableCell>
                  <TableCell className="p-4">
                    {inv.is_overdue ? (
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400">
                        {inv.days_overdue}d overdue
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400">
                        sent
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendReminder(inv)}
                        disabled={sendingReminder === inv.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
                        title={inv.billing_email ? `Send to ${inv.billing_email}` : 'No billing email'}
                      >
                        {sendingReminder === inv.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Remind
                      </button>
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        <ExternalLink size={12} />
                        View
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Layout>
  );
}