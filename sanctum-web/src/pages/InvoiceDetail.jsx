import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Plus, Trash2, Save, Download, Send, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Ad-Hoc Item State
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit_price: 0 });

  useEffect(() => { fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // --- ITEM LOGIC ---
  
  const handleUpdateItem = async (itemId, field, value) => {
    // 1. Optimistic Update (UI)
    const updatedItems = invoice.items.map(item => {
        if(item.id === itemId) {
            const newItem = { ...item, [field]: value };
            // Auto-calc total for UI snapiness
            if(field === 'quantity' || field === 'unit_price') {
                newItem.total = newItem.quantity * newItem.unit_price;
            }
            return newItem;
        }
        return item;
    });
    setInvoice({ ...invoice, items: updatedItems });

    // 2. API Call (Debounce would be better, but direct for now)
    try {
        const payload = { [field]: value };
        const res = await api.put(`/invoices/items/${itemId}`, payload);
        // 3. Sync Totals from Server
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

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'N/A';

  if (loading || !invoice) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  const isLocked = invoice.status === 'paid';

  return (
    <Layout title={`Invoice #${invoice.id.slice(0,8)}`}>
      
      {/* HEADER */}
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
            {/* ACTIONS */}
            {invoice.status === 'draft' && (
                <button onClick={() => updateStatus('sent')} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm">
                    <Send size={16} /> Mark Sent
                </button>
            )}
            {invoice.status === 'sent' && (
                <button onClick={() => updateStatus('paid')} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold text-sm">
                    <CheckCircle size={16} /> Mark Paid
                </button>
            )}
            {/* Future: Print Button linking to PDF generation */}
            <button className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm">
                <Download size={16} /> PDF
            </button>
        </div>
      </div>

      {/* DOCUMENT UI */}
      <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
          
          {/* Paper Header */}
          <div className="p-8 border-b border-slate-200 flex justify-between">
              <div>
                  <h2 className="text-2xl font-bold text-slate-800">TAX INVOICE</h2>
                  <p className="text-slate-500 text-sm mt-1">Digital Sanctum Pty Ltd</p>
                  <p className="text-slate-500 text-sm">ABN: 12 345 678 901</p>
              </div>
              <div className="text-right">
                  <p className="text-slate-500 text-sm">Invoice Date: {formatDate(invoice.generated_at)}</p>
                  <p className="text-slate-500 text-sm font-bold">Total Due: {formatCurrency(invoice.total_amount)}</p>
              </div>
          </div>

          {/* Line Items */}
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
                                            // Handle React State update only for typing
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
              <div className="flex justify-end">
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

    </Layout>
  );
}