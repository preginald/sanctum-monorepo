import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Plus, Trash2, Save, Download, Send, CheckCircle, Mail, X } from 'lucide-react';
import api from '../lib/api';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // === STATE ===
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Ad-Hoc Item Form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit_price: 0 });

  // Send Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', cc: [], subject: '', message: '' });
  const [sending, setSending] = useState(false);

  // === INITIALIZATION ===
  useEffect(() => { fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
      
      // PRE-FILL EMAIL FORM
      setSendForm(prev => ({
          ...prev,
          subject: `Invoice #${res.data.id.slice(0,8)} from Digital Sanctum`
      }));
      
      // GET CLIENT EMAIL
      if(res.data.account_id) {
          api.get(`/accounts/${res.data.account_id}`).then(accRes => {
              if(accRes.data.billing_email) {
                  setSendForm(prev => ({ ...prev, to: accRes.data.billing_email }));
              }
          });
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // === ITEM HANDLERS (CRUD) ===
  
  const handleUpdateItem = async (itemId, field, value) => {
    // Optimistic UI Update
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

    // API Call
    try {
        const payload = { [field]: value };
        const res = await api.put(`/invoices/items/${itemId}`, payload);
        setInvoice(res.data); 
    } catch (e) { console.error("Failed to update item"); fetchInvoice(); }
  };

  const handleAddItem = async (e) => {
      e.preventDefault();
      try {
          const res = await api.post(`/invoices/${id}/items`, newItem);
          setInvoice(res.data);
          setShowAddItem(false);
          setNewItem({ description: '', quantity: 1, unit_price: 0 });
      } catch (e) { alert("Failed to add item"); }
  };

  const handleDeleteItem = async (itemId) => {
      if(!confirm("Remove line item?")) return;
      try {
          const res = await api.delete(`/invoices/items/${itemId}`);
          setInvoice(res.data);
      } catch (e) { alert("Failed to delete item"); }
  };

  const updateStatus = async (newStatus) => {
      try {
          const res = await api.put(`/invoices/${id}`, { status: newStatus });
          setInvoice(res.data);
      } catch (e) { alert("Status update failed"); }
  };

  // --- UPDATE TERMS ---
  const handleUpdateTerms = async (val) => {
      setInvoice({ ...invoice, payment_terms: val });
      try {
          await api.put(`/invoices/${id}`, { payment_terms: val });
      } catch(e) { alert("Failed to save terms"); }
  };

  // === EMAIL HANDLERS ===
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
              message: sendForm.message
          });
          alert("Invoice Sent Successfully");
          setShowSendModal(false);
          fetchInvoice(); // Reload logs
      } catch (e) {
          alert("Failed to send email.");
      } finally {
          setSending(false);
      }
  };

  // === HELPERS ===
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString() : 'N/A';

  // PDF URL GENERATOR (Handles Local Dev vs Prod)
  const getPdfUrl = (path) => {
      if (!path) return '#';
      // If we are in development (localhost:5173), we need to point to backend port 8000
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return `http://${window.location.hostname}:8000${path}`;
      }
      // In production, the proxy/nginx handles the relative path
      return path;
  };

  if (loading || !invoice) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  const isLocked = invoice.status === 'paid';

  return (
    <Layout title={`Invoice #${invoice.id.slice(0,8)}`}>
      
      {/* --- HEADER --- */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/clients/${invoice.account_id}`)} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-bold">{invoice.account_name}</h1>
            <div className="flex items-center gap-4 mt-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${invoice.status === 'paid' ? 'bg-green-500 text-slate-900' : 'bg-yellow-500 text-slate-900'}`}>
                    {invoice.status}
                </span>
                <span className="text-sm opacity-50 font-mono">Due: {formatDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
            
            {/* SEND BUTTON (Visible for Draft AND Sent) */}
            {invoice.status !== 'paid' && (
                <button 
                    onClick={() => setShowSendModal(true)} 
                    className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition-transform hover:-translate-y-0.5"
                >
                    <Send size={16} /> {invoice.status === 'sent' ? 'Resend Email' : 'Send via Email'}
                </button>
            )}

            {/* MARK PAID (Visible if Sent) */}
            {invoice.status === 'sent' && (
                <button onClick={() => updateStatus('paid')} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold text-sm">
                    <CheckCircle size={16} /> Mark Paid
                </button>
            )}

            {/* PDF DOWNLOAD (Now an Anchor Tag) */}
            {invoice.pdf_path ? (
                <a 
                    href={getPdfUrl(invoice.pdf_path)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                    <Download size={16} /> PDF
                </a>
            ) : (
                <button disabled className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 text-white/30 text-sm cursor-not-allowed">
                    <Loader2 size={16} className="animate-spin" /> Generating...
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- LEFT: INVOICE DOCUMENT --- */}
          <div className="lg:col-span-2 max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
              
              {/* Paper Header */}
              <div className="p-8 border-b border-slate-200 flex justify-between">
                  <div>
                      <h2 className="text-2xl font-bold text-slate-800">GST TAX INVOICE</h2>
                      <p className="text-slate-500 text-sm mt-1">Digital Sanctum Pty Ltd</p>
                      <p className="text-slate-500 text-sm">ABN: 57 221 340 918</p>
                  </div>
                  <div className="text-right">
                      <p className="text-slate-500 text-sm">Invoice Date: {formatDate(invoice.generated_at)}</p>
                      <p className="text-slate-500 text-sm font-bold">Total Due: {formatCurrency(invoice.total_amount)}</p>
                  </div>
              </div>

              {/* Line Items Table */}
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
                                      {/* TRACEABILITY BADGE */}
                                      {item.ticket_id && (
                                          <div className="mb-1">
                                              <button 
                                                onClick={() => navigate(`/tickets/${item.ticket_id}`)}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold uppercase hover:bg-blue-200 transition-colors"
                                              >
                                                Ref: Ticket #{item.ticket_id}
                                              </button>
                                          </div>
                                      )}
                                      {!isLocked ? (
                                          <input 
                                            className="w-full bg-transparent outline-none focus:border-b border-blue-500"
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
                                          <input 
                                            type="number"
                                            className="w-full bg-transparent outline-none text-center focus:border-b border-blue-500"
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
                                          <input 
                                            type="number"
                                            className="w-full bg-transparent outline-none text-right focus:border-b border-blue-500"
                                            value={item.unit_price}
                                            onBlur={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value))}
                                            onChange={(e) => {
                                                const updated = invoice.items.map(i => i.id === item.id ? {...i, unit_price: e.target.value} : i);
                                                setInvoice({...invoice, items: updated});
                                            }}
                                          />
                                      ) : `$${item.unit_price}`}
                                  </td>
                                  <td className="py-3 text-right font-mono font-bold">
                                      {formatCurrency(item.total)}
                                  </td>
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

              {/* Footer Totals */}
              <div className="bg-slate-50 p-8 border-t border-slate-200">
                  <div className="flex justify-between items-end">
                      
                      {/* PAYMENT TERMS EDITOR */}
                      <div className="text-sm text-slate-500">
                          <p className="mb-1 font-bold">Payment Terms:</p>
                          {!isLocked ? (
                              <select 
                                className="bg-transparent border-b border-slate-300 outline-none font-mono"
                                value={invoice.payment_terms || "Net 14 Days"}
                                onChange={(e) => handleUpdateTerms(e.target.value)}
                              >
                                  <option value="Net 14 Days">Net 14 Days</option>
                                  <option value="Net 7 Days">Net 7 Days</option>
                                  <option value="Due on Receipt">Due on Receipt</option>
                              </select>
                          ) : (
                              <span>{invoice.payment_terms}</span>
                          )}
                          
                          <p className="mt-4 text-xs font-mono">
                              Bank: Sanctum Bank<br/>
                              BSB: 063 010<br/>
                              ACC: 1149 9520
                          </p>
                      </div>

                      <div className="w-64 space-y-2">
                          <div className="flex justify-between text-sm text-slate-600">
                              <span>Subtotal</span>
                              <span>{formatCurrency(invoice.subtotal_amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-600">
                              <span>GST (10%)</span>
                              <span>{formatCurrency(invoice.gst_amount)}</span>
                          </div>
                          <div className="flex justify-between text-xl font-bold text-slate-900 border-t border-slate-300 pt-2">
                              <span>Total</span>
                              <span>{formatCurrency(invoice.total_amount)}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* --- RIGHT: DELIVERY HISTORY --- */}
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
                              <div className="opacity-50 text-xs mt-1">
                                  Sent by: {log.sender_name || 'System'}
                              </div>
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

      {/* --- SEND MODAL --- */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-lg relative">
                <button onClick={() => setShowSendModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Send size={20} className="text-blue-400"/> Send Invoice</h2>
                
                <form onSubmit={handleSendEmail} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">To (Billing Email)</label>
                        <input 
                            required type="email" 
                            className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" 
                            value={sendForm.to} 
                            onChange={e => setSendForm({...sendForm, to: e.target.value})} 
                        />
                    </div>
                    
                    {invoice.suggested_cc?.length > 0 && (
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Smart CC (Contextual)</label>
                            <div className="flex flex-wrap gap-2">
                                {invoice.suggested_cc.map(email => (
                                    <button
                                        key={email}
                                        type="button"
                                        onClick={() => toggleCC(email)}
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
                        <label className="text-xs opacity-50 block mb-1">Message (Optional)</label>
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