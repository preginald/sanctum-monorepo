import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Download, Loader2, Plus, Trash2, Send, CheckCircle, Mail, X, Ban, User, Calendar, CreditCard, Edit2 } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/ui/SearchableSelect';
import { PAYMENT_METHODS } from '../lib/constants';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToast();
  
  // === STATE ===
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accountContacts, setAccountContacts] = useState([]);
  
  // Track updates to force PDF refresh
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // MODAL STATES
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // NOTE: Removed confirmDelete state in favor of window.confirm for direct action
  const [confirmVoid, setConfirmVoid] = useState(false);

  // SEND FORM
  const [sendForm, setSendForm] = useState({ 
      to: '', 
      cc: [], 
      subject: '', 
      message: '', 
      recipient_contact_id: null,
      mode: 'search'
  });
  const [sending, setSending] = useState(false);

  // PAYMENT FORM
  const [paymentForm, setPaymentForm] = useState({
      paid_at: '',
      payment_method: 'bank_transfer'
  });

  // ITEM FORM
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit_price: 0 });

  // === INITIALIZATION ===
  useEffect(() => { fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
      setLastUpdate(Date.now());
      
      const isPaid = res.data.status === 'paid';
      const subjectLine = isPaid 
          ? `Receipt: Invoice #${res.data.id.slice(0,8).toUpperCase()} - PAID`
          : `Invoice #${res.data.id.slice(0,8).toUpperCase()} from Digital Sanctum`;
      
      if(res.data.account_id) {
          api.get(`/accounts/${res.data.account_id}`).then(accRes => {
              const contacts = accRes.data.contacts || [];
              setAccountContacts(contacts);

              let defaultEmail = accRes.data.billing_email || '';
              let defaultContactId = null;

              const billingLead = contacts.find(c => c.persona === 'Billing Lead');
              const primary = contacts.find(c => c.is_primary_contact);

              if (billingLead && billingLead.email) {
                  defaultEmail = billingLead.email;
                  defaultContactId = billingLead.id;
              } else if (primary && primary.email) {
                  defaultEmail = primary.email;
                  defaultContactId = primary.id;
              }

              setSendForm(prev => ({ 
                  ...prev, 
                  subject: subjectLine,
                  to: defaultEmail,
                  recipient_contact_id: defaultContactId,
                  mode: defaultContactId ? 'search' : 'manual' 
              }));
          });
      } else {
          setSendForm(prev => ({ ...prev, subject: subjectLine }));
      }

    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // === HANDLERS ===

  const handleVoid = async () => {
      try {
          await api.put(`/invoices/${id}/void`);
          addToast("Invoice Voided. Items released.", "success");
          fetchInvoice();
          setConfirmVoid(false);
      } catch (e) {
          addToast("Failed to void invoice: " + (e.response?.data?.detail || "Unknown error"), "danger");
      }
  };

  const handleUpdateItem = async (itemId, field, value) => {
    const updatedItems = invoice.items.map(item => {
        if(item.id === itemId) {
            const newItem = { ...item, [field]: value };
            if(field === 'quantity' || field === 'unit_price') {
                newItem.total = newItem.quantity * newItem.unit_price;
            }
            return newItem;
        }
        return item;
    });
    setInvoice({ ...invoice, items: updatedItems });

    try {
        const payload = { [field]: value };
        await api.put(`/invoices/items/${itemId}`, payload);
        setLastUpdate(Date.now()); 
    } catch (e) { console.error("Failed to update item"); fetchInvoice(); }
  };

  const handleAddItem = async (e) => {
      e.preventDefault();
      try {
          const res = await api.post(`/invoices/${id}/items`, newItem);
          setInvoice(res.data);
          setShowAddItem(false);
          setNewItem({ description: '', quantity: 1, unit_price: 0 });
          setLastUpdate(Date.now());
      } catch (e) { addToast("Failed to add item", "danger"); }
  };

  const handleDeleteItem = async (itemId) => {
      if(!window.confirm("Remove line item?")) return;
      try {
          const res = await api.delete(`/invoices/items/${itemId}`);
          setInvoice(res.data);
          setLastUpdate(Date.now());
      } catch (e) { addToast("Failed to delete item", "danger"); }
  };

  // --- DELETE INVOICE HANDLER (UPDATED) ---
  const handleDeleteInvoice = async () => {
      // Use window.confirm to bypass potentially broken modal state/rendering
      if (!window.confirm("Are you sure you want to delete this draft invoice? This action cannot be undone.")) {
          return;
      }
      
      console.log("Attempting to delete invoice:", id);
      try {
          await api.delete(`/invoices/${id}`);
          console.log("Delete success, navigating...");
          addToast("Invoice deleted", "info");
          
          // Small delay to ensure toast is seen before nav
          setTimeout(() => {
              navigate(`/clients/${invoice.account_id}`);
          }, 100);
      } catch (e) {
          console.error("Delete failed:", e);
          const msg = e.response?.data?.detail || "Failed to delete invoice";
          addToast(msg, "danger");
      }
  };

  // --- PAYMENT LOGIC ---
  
  const openPaymentModal = () => {
      setPaymentForm({
          paid_at: new Date().toISOString().slice(0, 16), 
          payment_method: 'bank_transfer'
      });
      setShowPaymentModal(true);
  };

  const handleEditPayment = () => {
      setPaymentForm({
          paid_at: invoice.paid_at ? new Date(invoice.paid_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
          payment_method: invoice.payment_method || 'bank_transfer'
      });
      setShowPaymentModal(true);
  };

  const handleMarkPaid = async (e) => {
      e.preventDefault();
      try {
          const payload = { 
              status: 'paid',
              paid_at: new Date(paymentForm.paid_at).toISOString(),
              payment_method: paymentForm.payment_method
          };

          const res = await api.put(`/invoices/${id}`, payload);
          setInvoice(res.data);
          setLastUpdate(Date.now()); 
          setShowPaymentModal(false);
          addToast("Payment Details Updated", "success");
          
          setSendForm(prev => ({...prev, subject: `Receipt: Invoice #${res.data.id.slice(0,8).toUpperCase()} - PAID`}));
      } catch (e) { 
          addToast("Payment update failed", "danger"); 
      }
  };

  const handleUpdateTerms = async (val) => {
      setInvoice({ ...invoice, payment_terms: val });
      try {
          await api.put(`/invoices/${id}`, { payment_terms: val });
          setLastUpdate(Date.now());
      } catch(e) { addToast("Failed to save terms", "danger"); }
  };

  const handleSelectContact = (contact) => {
      setSendForm(prev => ({
          ...prev,
          to: contact.email,
          recipient_contact_id: contact.id
      }));
  };

  const toggleCC = (email) => {
      const current = sendForm.cc;
      setSendForm({
          ...sendForm,
          cc: current.includes(email) ? current.filter(e => e !== email) : [...current, email]
      });
  };

  const handleSendEmail = async (e) => {
      e.preventDefault();
      setSending(true);
      try {
          await api.post(`/invoices/${id}/send`, {
              to_email: sendForm.to,
              cc_emails: sendForm.cc,
              subject: sendForm.subject,
              message: sendForm.message,
              recipient_contact_id: sendForm.recipient_contact_id 
          });
          addToast("Email Sent Successfully", "success");
          setShowSendModal(false);
          fetchInvoice();
      } catch (e) {
          addToast("Failed to send email.", "danger");
      } finally {
          setSending(false);
      }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString() : 'N/A';

  const getPdfUrl = (path) => {
      if (!path) return '#';
      let url = path;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          url = `http://${window.location.hostname}:8000${path}`;
      }
      return `${url}?v=${lastUpdate}`;
  };

  if (loading || !invoice) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  const invoiceStatusColor = (s) => {
    const map = { draft: 'bg-yellow-500/20 text-yellow-400', sent: 'bg-blue-500/20 text-blue-400', paid: 'bg-green-500/20 text-green-400', void: 'bg-red-500/20 text-red-400', overdue: 'bg-orange-500/20 text-orange-400' };
    return map[s] || 'bg-white/10 text-slate-300';
  };

  const isLocked = invoice.status === 'paid';
  const isDraft = invoice.status === 'draft';
  const isAdmin = user?.role === 'admin';

  const contactOptions = accountContacts.map(c => ({
      id: c.id,
      title: c.email,
      identifier: `${c.first_name} ${c.last_name} (${c.persona || 'Contact'})`,
      original: c
  }));

  const selectedContact = accountContacts.find(c => c.id === sendForm.recipient_contact_id);
  const greetingName = selectedContact ? selectedContact.first_name : "Team";

  const getSendLabel = () => {
      if (invoice.status === 'paid') return 'Send Receipt';
      if (invoice.status === 'sent') return 'Resend Email';
      return 'Send via Email';
  };

  return (
    <Layout
      title={`Invoice #${invoice.id.slice(0,8).toUpperCase()}`}
      subtitle={<><button onClick={() => navigate(`/clients/${invoice.account_id}`)} className="text-sanctum-gold hover:underline">{invoice.account_name}</button> • {invoice.status === 'paid' && invoice.paid_at ? <span className="text-green-400">Paid {formatDate(invoice.paid_at)}</span> : <span>Due {formatDate(invoice.due_date)}</span>}</>}
      badge={{ label: invoice.status, className: invoiceStatusColor(invoice.status) }}
      backPath={`/clients/${invoice.account_id}`}
      actions={
        <div className="flex gap-2 items-center">
          {isDraft && isAdmin && (
            <button onClick={handleDeleteInvoice} className="flex items-center gap-2 px-4 py-2 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 font-bold text-sm border border-red-500/30 transition-colors">
              <Trash2 size={16} /> Delete Draft
            </button>
          )}
          {invoice.status === 'sent' && isAdmin && (
            <button onClick={() => setConfirmVoid(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 font-bold text-sm border border-red-500/30 transition-colors">
              <Ban size={16} /> Void
            </button>
          )}
          <button onClick={() => setShowSendModal(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition-transform hover:-translate-y-0.5">
            <Send size={16} /> {getSendLabel()}
          </button>
          {invoice.status === 'sent' && (
            <button onClick={openPaymentModal} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition-transform hover:-translate-y-0.5 shadow-lg">
              <CheckCircle size={16} /> Mark Paid
            </button>
          )}
          {invoice.status === 'paid' && (
            <button onClick={handleEditPayment} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors border border-white/10">
              <Edit2 size={16} /> Edit Payment
            </button>
          )}
          {invoice.pdf_path ? (
            <a href={getPdfUrl(invoice.pdf_path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
              <Download size={16} /> PDF
            </a>
          ) : (
            <button disabled className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 text-white/30 text-sm cursor-not-allowed">
              <Loader2 size={16} className="animate-spin" /> Generating...
            </button>
          )}
        </div>
      }
    >
      <ConfirmationModal 
          isOpen={confirmVoid} onClose={() => setConfirmVoid(false)} onConfirm={handleVoid}
          title="Void Invoice?" message="Release items back to pool?" isDangerous={true}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
              <div className="p-8 border-b border-slate-200 flex justify-between">
                  <div>
                      <h2 className="text-2xl font-bold text-slate-800">GST TAX INVOICE</h2>
                      <p className="text-slate-500 text-sm mt-1">Digital Sanctum Pty Ltd</p>
                      <p className="text-slate-500 text-sm">ABN: 57 221 340 918</p>
                  </div>
                  <div className="text-right">
                      <p className="text-slate-500 text-sm">Invoice Date: {formatDate(invoice.generated_at)}</p>
                      <p className="text-slate-500 text-sm font-bold">Total Due: {formatCurrency(invoice.total_amount)}</p>
                      {invoice.status === 'paid' && invoice.payment_method && (
                          <p className="text-green-600 text-xs font-bold uppercase mt-1">
                              Paid via {PAYMENT_METHODS.find(m => m.value === invoice.payment_method)?.label || invoice.payment_method}
                          </p>
                      )}
                  </div>
              </div>

              <div className="p-8 flex-1">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="border-b-2 border-slate-800 text-slate-600 uppercase text-xs tracking-wider">
                              <th className="py-2 w-1/2">Description</th>
                              <th className="py-2 w-24 text-center">Qty</th>
                              <th className="py-2 w-32 text-right">Unit Price</th>
                              <th className="py-2 w-32 text-right">Total</th>
                              {!isLocked && <th className="py-2 w-10"></th>}
                          </tr>
                      </thead>
                      <tbody className="text-slate-700">
                          {invoice.items.map(item => (
                              <tr key={item.id} className="border-b border-slate-100 group hover:bg-slate-50">
                                  <td className="py-3 pr-4">
                                      {item.ticket_id && (
                                          <div className="mb-1">
                                              <button onClick={() => navigate(`/tickets/${item.ticket_id}`)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-200 transition-colors">
                                                  Ref: Ticket #{item.ticket_id}
                                              </button>
                                          </div>
                                      )}
                                      {!isLocked ? (
                                          <input className="w-full bg-transparent outline-none focus:border-b border-blue-500"
                                              value={item.description}
                                              onBlur={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                              onChange={(e) => {
                                                  const updated = invoice.items.map(i => i.id === item.id ? {...i, description: e.target.value} : i);
                                                  setInvoice({...invoice, items: updated});
                                              }}
                                          />
                                      ) : item.description}
                                  </td>
                                  <td className="py-3 text-center">
                                      {!isLocked ? (
                                          <input type="number" className="w-full bg-transparent outline-none text-center focus:border-b border-blue-500"
                                              value={item.quantity}
                                              onBlur={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value))}
                                              onChange={(e) => {
                                                  const updated = invoice.items.map(i => i.id === item.id ? {...i, quantity: e.target.value} : i);
                                                  setInvoice({...invoice, items: updated});
                                              }}
                                          />
                                      ) : item.quantity}
                                  </td>
                                  <td className="py-3 text-right font-mono">
                                      {!isLocked ? (
                                          <input type="number" className="w-full bg-transparent outline-none text-right focus:border-b border-blue-500"
                                              value={item.unit_price}
                                              onBlur={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value))}
                                              onChange={(e) => {
                                                  const updated = invoice.items.map(i => i.id === item.id ? {...i, unit_price: e.target.value} : i);
                                                  setInvoice({...invoice, items: updated});
                                              }}
                                          />
                                      ) : `$${item.unit_price}`}
                                  </td>
                                  <td className="py-3 text-right font-mono font-bold">{formatCurrency(item.total)}</td>
                                  {!isLocked && (
                                      <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                      </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>

                  {!isLocked && !showAddItem && (
                      <button onClick={() => setShowAddItem(true)} className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline uppercase tracking-wide">
                          <Plus size={14} /> Add Line Item
                      </button>
                  )}

                  {showAddItem && (
                      <form onSubmit={handleAddItem} className="mt-4 flex gap-2 items-center bg-slate-50 p-2 rounded border border-blue-200">
                          <input autoFocus placeholder="Description" className="flex-1 p-2 border rounded text-sm" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                          <input type="number" placeholder="Qty" className="w-20 p-2 border rounded text-sm" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})} />
                          <input type="number" placeholder="Price" className="w-24 p-2 border rounded text-sm" value={newItem.unit_price} onChange={e => setNewItem({...newItem, unit_price: parseFloat(e.target.value)})} />
                          <button type="submit" className="p-2 bg-blue-600 text-white rounded"><Plus size={16}/></button>
                          <button type="button" onClick={() => setShowAddItem(false)} className="p-2 text-slate-500"><X size={16}/></button>
                      </form>
                  )}
              </div>

              <div className="bg-slate-50 p-8 border-t border-slate-200">
                  <div className="flex justify-between items-end">
                      <div className="text-sm text-slate-500">
                          <p className="mb-1 font-bold">Payment Terms:</p>
                          {!isLocked ? (
                              <select className="bg-transparent border-b border-slate-300 outline-none font-mono" value={invoice.payment_terms || "Net 14 Days"} onChange={(e) => handleUpdateTerms(e.target.value)}>
                                  <option value="Net 14 Days">Net 14 Days</option>
                                  <option value="Net 7 Days">Net 7 Days</option>
                                  <option value="Due on Receipt">Due on Receipt</option>
                              </select>
                          ) : <span>{invoice.payment_terms}</span>}
                          
                          <p className="mt-4 text-xs font-mono">
                              Bank: Sanctum Bank<br/>BSB: 063 010<br/>ACC: 1149 9520
                          </p>
                      </div>

                      <div className="w-64 space-y-2">
                          <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal_amount)}</span></div>
                          <div className="flex justify-between text-sm text-slate-600"><span>GST (10%)</span><span>{formatCurrency(invoice.gst_amount)}</span></div>
                          <div className="flex justify-between text-xl font-bold text-slate-900 border-t border-slate-300 pt-2"><span>Total</span><span>{formatCurrency(invoice.total_amount)}</span></div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
                      <Mail size={16} /> Delivery History
                  </h3>
                  <div className="space-y-4">
                      {invoice.delivery_logs?.map(log => (
                          <div key={log.id} className="text-sm border-l-2 border-slate-600 pl-4 py-1">
                              <div className="font-bold flex justify-between">
                                  <span>{formatDateTime(log.sent_at)}</span>
                                  <span className="text-xs uppercase bg-green-500/20 text-green-500 px-1 rounded">{log.status}</span>
                              </div>
                              <div className="opacity-50 text-xs mt-1">Sent by: {log.sender_name || 'System'}</div>
                              <div className="mt-1 bg-black/20 p-2 rounded text-xs font-mono break-all">
                                  To: {log.sent_to}
                                  {log.sent_cc && <><br/>CC: {log.sent_cc}</>}
                              </div>
                          </div>
                      ))}
                      {invoice.delivery_logs?.length === 0 && <div className="text-xs opacity-30 italic">Not sent yet.</div>}
                  </div>
              </div>
          </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative animate-in fade-in zoom-in-95">
                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle size={20} className="text-green-400"/> Record Payment</h2>
                
                <form onSubmit={handleMarkPaid} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Date Paid</label>
                        <div className="relative">
                            <Calendar className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                            <input 
                                required type="datetime-local" 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                                value={paymentForm.paid_at}
                                onChange={e => setPaymentForm({...paymentForm, paid_at: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs opacity-50 block mb-1">Payment Method</label>
                        <div className="relative">
                            <CreditCard className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
                            <select 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-green-500 appearance-none"
                                value={paymentForm.payment_method}
                                onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                            >
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded flex justify-center items-center gap-2 mt-4">
                        {invoice.status === 'paid' ? 'Update Payment' : 'Confirm Payment'}
                    </button>
                </form>
            </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-lg relative animate-in fade-in zoom-in-95">
                <button onClick={() => setShowSendModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Send size={20} className="text-blue-400"/> {getSendLabel()}</h2>
                
                <form onSubmit={handleSendEmail} className="space-y-4">
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <label className="text-xs opacity-50">To (Recipient)</label>
                            <button 
                                type="button" 
                                onClick={() => setSendForm(prev => ({...prev, mode: prev.mode === 'search' ? 'manual' : 'search'}))}
                                className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                            >
                                {sendForm.mode === 'search' ? 'Enter Custom Email' : 'Search Contacts'}
                            </button>
                        </div>

                        {sendForm.mode === 'search' ? (
                            <SearchableSelect 
                                items={contactOptions}
                                labelKey="title"      
                                subLabelKey="identifier" 
                                valueKey="id"
                                icon={User}
                                placeholder="Search contacts..."
                                onSelect={(item) => handleSelectContact(item.original)}
                                selectedIds={[sendForm.recipient_contact_id]}
                            />
                        ) : (
                            <input 
                                required type="email" autoFocus
                                className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" 
                                placeholder="client@example.com"
                                value={sendForm.to} 
                                onChange={e => setSendForm({...sendForm, to: e.target.value, recipient_contact_id: null})} 
                            />
                        )}
                        
                        {sendForm.recipient_contact_id && sendForm.mode === 'search' && (
                             <div className="mt-2 text-xs text-green-400 flex items-center gap-1 bg-green-900/10 p-2 rounded border border-green-500/20">
                                <CheckCircle size={12} /> 
                                Will greet as: <span className="font-bold">Hi {greetingName},</span>
                             </div>
                        )}
                    </div>
                    
                    {invoice.suggested_cc?.length > 0 && (
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Smart CC</label>
                            <div className="flex flex-wrap gap-2">
                                {invoice.suggested_cc.map(email => (
                                    <button
                                        key={email} type="button" onClick={() => toggleCC(email)}
                                        className={`px-2 py-1 rounded text-xs border transition-colors ${sendForm.cc.includes(email) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-slate-600 text-slate-400 hover:border-slate-400'}`}
                                    >
                                        {email}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs opacity-50 block mb-1">Subject</label>
                        <input className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={sendForm.subject} onChange={e => setSendForm({...sendForm, subject: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Message</label>
                        <textarea className="w-full p-2 h-24 rounded bg-black/40 border border-slate-600 text-white text-sm" value={sendForm.message} onChange={e => setSendForm({...sendForm, message: e.target.value})} placeholder="Add a personal note..." />
                    </div>

                    <button type="submit" disabled={sending} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex justify-center items-center gap-2">
                        {sending ? <Loader2 className="animate-spin" size={18}/> : 'Send Invoice'}
                    </button>
                </form>
            </div>
        </div>
      )}

    </Layout>
  );
}