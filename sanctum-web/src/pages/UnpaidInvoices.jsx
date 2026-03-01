import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import api from '../lib/api';
import { Loader2, AlertTriangle, Send, ExternalLink, DollarSign, Clock, CheckSquare, Square, CreditCard, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PAYMENT_METHODS } from '../lib/constants';
import SearchableSelect from '../components/ui/SearchableSelect';
import SendNotificationForm from '../components/ui/SendNotificationForm';

export default function UnpaidInvoices() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [form, setForm] = useState({});
  const [sendingBulk, setSendingBulk] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [computedSubject, setComputedSubject] = useState('');
  const [multiAccountError, setMultiAccountError] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    payment_method: 'bank_transfer',
    paid_at: new Date().toISOString().split('T')[0],
    send_receipt: false,
  });
  const [recipients, setRecipients] = useState([]); // [{ invoice_id, email }]
  const [paying, setPaying] = useState(false);

  // When modal opens, prefill recipients from selected invoices
  const openPayModal = () => {
    if (!invoices) return;
    const prefilled = invoices
      .filter(i => selectedIds.has(i.id))
      .map(i => ({ invoice_id: i.id, account_name: i.account_name, email: i.billing_email || '', cc_emails: [] }));
    setRecipients(prefilled);
    setShowPayModal(true);
  };

  const updateRecipientEmail = (invoice_id, email) => {
    setRecipients(prev => prev.map(r => r.invoice_id === invoice_id ? { ...r, email } : r));
  };

  const toggleCC = (invoice_id, email) => {
    setRecipients(prev => prev.map(r => {
      if (r.invoice_id !== invoice_id) return r;
      const cc = r.cc_emails.includes(email)
        ? r.cc_emails.filter(e => e !== email)
        : [...r.cc_emails, email];
      return { ...r, cc_emails: cc };
    }));
  };

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

  const openSendModal = (singleInv = null) => {
    setMultiAccountError('');
    if (singleInv) {
      setPendingInvoices([singleInv]);
      setComputedSubject('Payment Reminder: Invoice from Digital Sanctum');
      setShowSendModal(true);
      return;
    }
    const selected = invoices.filter(i => selectedIds.has(i.id));
    const accountIds = [...new Set(selected.map(i => i.account_id))];
    if (accountIds.length > 1) {
      setMultiAccountError('Bulk send is limited to one client account at a time. Please filter your selection.');
      return;
    }
    setPendingInvoices(selected);
    setComputedSubject('Payment Reminder: Outstanding Invoices from Digital Sanctum');
    setShowSendModal(true);
  };

  const handleBulkSend = async () => {
    setSendingBulk(true);
    try {
      for (const inv of pendingInvoices) {
        await api.post(`/invoices/${inv.id}/send`, {
          to_email: form.test_mode ? 'peter@digitalsanctum.com.au' : form.to,
          cc_emails: form.test_mode ? [] : form.cc,
          subject: form.test_mode ? `[TEST] ${form.subject}` : form.subject,
          message: form.message,
          recipient_contact_id: form.test_mode ? null : form.recipient_contact_id
        });
      }
      addToast(`Reminder${pendingInvoices.length !== 1 ? 's' : ''} sent successfully`, 'success');
      setShowSendModal(false);
      fetchUnpaid();
    } catch (e) {
      addToast('Failed to send reminder', 'danger');
    } finally { setSendingBulk(false); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!invoices) return;
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map(i => i.id)));
    }
  };

  const selectedTotal = () => {
    if (!invoices) return 0;
    return invoices
      .filter(i => selectedIds.has(i.id))
      .reduce((sum, i) => sum + i.total_amount, 0);
  };

  const handleBulkMarkPaid = async () => {
    setPaying(true);
    try {
      const res = await api.post('/invoices/bulk-mark-paid', {
        invoice_ids: Array.from(selectedIds),
        payment_method: payForm.payment_method,
        paid_at: new Date(payForm.paid_at).toISOString(),
        send_receipt: payForm.send_receipt,
        recipients: payForm.send_receipt
          ? recipients.map(r => ({ invoice_id: r.invoice_id, email: r.email }))
          : [],
      });
      addToast(`${res.data.updated} invoice${res.data.updated !== 1 ? 's' : ''} marked as paid`, "success");
      if (payForm.send_receipt) {
        if (res.data.emails_sent > 0) addToast(`${res.data.emails_sent} receipt${res.data.emails_sent !== 1 ? 's' : ''} sent`, "success");
        if (res.data.emails_failed > 0) addToast(`${res.data.emails_failed} receipt${res.data.emails_failed !== 1 ? 's' : ''} failed to send`, "danger");
      }
      setSelectedIds(new Set());
      setShowPayModal(false);
      fetchUnpaid();
    } catch (e) {
      addToast("Failed to mark invoices as paid", "danger");
    } finally { setPaying(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-AU') : '—';

  if (loading) return <Layout title="Unpaid Invoices"><Loader2 className="animate-spin" /></Layout>;

  const { total_count, total_outstanding, overdue_count, invoices } = data || { total_count: 0, total_outstanding: 0, overdue_count: 0, invoices: [] };

  return (
    <Layout title="Unpaid Invoices" onRefresh={fetchUnpaid}>

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><Send size={18} className="text-blue-400"/> Send Reminder</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {pendingInvoices.length === 1
                    ? `Invoice #${pendingInvoices[0].id.slice(0, 8).toUpperCase()} — ${pendingInvoices[0].account_name}`
                    : `${pendingInvoices.length} invoices — ${pendingInvoices[0]?.account_name}`}
                </p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="opacity-50 hover:opacity-100"><X size={20}/></button>
            </div>
            <SendNotificationForm
              accountId={pendingInvoices[0]?.account_id}
              defaultSubject={computedSubject}
              onChange={setForm}
              disabled={sendingBulk}
            />
            <button
              type="button"
              onClick={handleBulkSend}
              disabled={sendingBulk}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {sendingBulk ? <Loader2 className="animate-spin" size={18}/> : <Send size={16}/>}
              {pendingInvoices.length === 1 ? 'Send Reminder' : `Send to ${pendingInvoices.length} Invoices`}
            </button>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold">Mark {selectedIds.size} Invoice{selectedIds.size !== 1 ? 's' : ''} as Paid</h2>
              <p className="text-sm text-slate-400 mt-1">Total: <span className="text-sanctum-gold font-bold">{formatCurrency(selectedTotal())}</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment Method</label>
                <select
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-sanctum-gold"
                  value={payForm.payment_method}
                  onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Payment Date</label>
                <input
                  type="date"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-sanctum-gold"
                  value={payForm.paid_at}
                  onChange={e => setPayForm({ ...payForm, paid_at: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-green-900/10 border border-green-500/20 cursor-pointer hover:bg-green-900/20 transition-colors">
                <input
                  type="checkbox"
                  checked={payForm.send_receipt}
                  onChange={e => setPayForm({ ...payForm, send_receipt: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-bold text-white block">Send Receipt Email</span>
                  <span className="text-xs text-slate-400">Sends a payment receipt to each client's billing email</span>
                </div>
              </label>

              {/* PER-INVOICE RECIPIENT FIELDS */}
              {payForm.send_receipt && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receipt Recipients</p>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {recipients.map(r => (
                      <div key={r.invoice_id} className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-xs font-bold text-white">{r.account_name}</p>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">To</label>
                          <input
                            type="email"
                            className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-xs outline-none focus:border-sanctum-gold"
                            value={r.email}
                            onChange={e => updateRecipientEmail(r.invoice_id, e.target.value)}
                            placeholder="billing@client.com"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">CC</label>
                          <SearchableSelect
                            items={[]}
                            allowCreate
                            placeholder="Add CC email..."
                            selectedIds={r.cc_emails}
                            labelKey="title"
                            valueKey="id"
                            displaySelected={false}
                            onSelect={(item) => item && toggleCC(r.invoice_id, item.id)}
                          />
                          {r.cc_emails.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.cc_emails.map(email => (
                                <span key={email} className="flex items-center gap-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  {email}
                                  <button type="button" onClick={() => toggleCC(r.invoice_id, email)} className="hover:text-red-400"><X size={10}/></button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkMarkPaid}
                disabled={paying}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* BULK CTA BAR */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <CheckSquare size={18} className="text-green-400" />
            <span className="text-sm font-bold text-white">{selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <span className="text-sm text-green-400 font-bold">{formatCurrency(selectedTotal())}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openSendModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-900/30"
            >
              <Send size={14} /> Send Reminder
            </button>
            <button
              onClick={openPayModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors shadow-lg shadow-green-900/30"
            >
              <CreditCard size={14} /> Mark Selected Paid
            </button>
          </div>
        </div>
      )}

      {multiAccountError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-3 text-sm text-red-400 animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertTriangle size={16} className="shrink-0" />
          {multiAccountError}
        </div>
      )}

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
                <TableHead className="p-4 w-10">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white transition-colors">
                    {selectedIds.size === invoices.length && invoices.length > 0
                      ? <CheckSquare size={16} className="text-green-400" />
                      : <Square size={16} />}
                  </button>
                </TableHead>
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
                  className={`border-b border-slate-800 hover:bg-white/5 transition-colors ${inv.is_overdue ? 'bg-red-500/5' : ''} ${selectedIds.has(inv.id) ? 'bg-green-500/5' : ''}`}
                >
                  <TableCell className="p-4">
                    <button onClick={() => toggleSelect(inv.id)} className="text-slate-400 hover:text-white transition-colors">
                      {selectedIds.has(inv.id)
                        ? <CheckSquare size={16} className="text-green-400" />
                        : <Square size={16} />}
                    </button>
                  </TableCell>
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
                        onClick={() => openSendModal(inv)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                      >
                        <Send size={12} />
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
