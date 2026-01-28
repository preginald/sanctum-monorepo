import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2, RefreshCw, Server, Globe, Calendar } from 'lucide-react';
import { ASSET_TYPES, ASSET_STATUSES } from '../../lib/constants';
import api from '../../lib/api';

export default function AssetModal({ isOpen, onClose, onSubmit, loading, form, setForm }) {
  const [catalog, setCatalog] = useState([]);
  
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  
  // Logic: Is this a "Digital" asset that expires?
  // We treat 'domain', 'hosting', 'license', 'software' as digital.
  const isDigital = ['domain', 'hosting_web', 'hosting_email', 'license', 'software'].some(t => form.asset_type?.includes(t));

  // Load Catalog for Linking
  useEffect(() => {
      if (isOpen) {
          api.get('/products').then(res => {
              // Only show recurring products in the dropdown to avoid confusion
              setCatalog(res.data.filter(p => p.is_recurring));
          });
      }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={form.id ? "Edit Asset" : "Deploy Asset"}>
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="text-xs opacity-50 block mb-1">Asset Name</label>
                <input 
                    required 
                    autoFocus 
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-sanctum-blue outline-none" 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    placeholder={isDigital ? "e.g. digitalsanctum.com.au" : "e.g. FILE-SRV-01"} 
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs opacity-50 block mb-1">Type</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white capitalize focus:border-sanctum-blue outline-none" value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})}>
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs opacity-50 block mb-1">Status</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white capitalize focus:border-sanctum-blue outline-none" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                        {ASSET_STATUSES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
                    </select>
                </div>
            </div>

            {/* CONDITIONAL UI: DIGITAL vs PHYSICAL */}
            {isDigital ? (
                <div className="bg-slate-800/50 p-4 rounded border border-purple-500/30 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest border-b border-purple-500/20 pb-2">
                        <RefreshCw size={12}/> Lifecycle & Billing
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Expiry Date</label>
                            <input 
                                type="date" 
                                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                                value={form.expires_at || ''} 
                                onChange={e => setForm({...form, expires_at: e.target.value})} 
                            />
                        </div>
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Vendor / Registrar</label>
                            <input 
                                className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                                value={form.vendor || ''} 
                                onChange={e => setForm({...form, vendor: e.target.value})} 
                                placeholder="e.g. GoDaddy" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs opacity-50 block mb-1">Linked Service (Catalog)</label>
                        <select 
                            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" 
                            value={form.linked_product_id || ''} 
                            onChange={e => setForm({...form, linked_product_id: e.target.value})}
                        >
                            <option value="">-- No Auto-Billing --</option>
                            {catalog.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (${Number(p.unit_price).toFixed(0)}/{p.billing_frequency === 'monthly' ? 'mo' : 'yr'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {form.linked_product_id && (
                        <label className="flex items-center gap-3 p-3 rounded bg-purple-900/10 border border-purple-500/30 cursor-pointer hover:bg-purple-900/20 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={form.auto_invoice || false} 
                                onChange={e => setForm({...form, auto_invoice: e.target.checked})}
                                className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500 bg-slate-900 cursor-pointer"
                            />
                            <div>
                                <span className="text-sm font-bold text-white block">Auto-Generate Invoice</span>
                                <span className="text-xs opacity-50 block">System will draft an invoice 30 days before expiry.</span>
                            </div>
                        </label>
                    )}
                </div>
            ) : (
                /* PHYSICAL ASSET FIELDS */
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">IP Address</label>
                        <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm" value={form.ip_address || ''} onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.x.x" />
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Serial / Key</label>
                        <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="XYZ-123" />
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs opacity-50 block mb-1">Notes</label>
                <textarea className="w-full p-2 h-20 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex justify-center items-center gap-2 transition-transform active:scale-[0.98]">
                {loading && <Loader2 className="animate-spin" size={16}/>} Save Asset
            </button>
        </form>
    </Modal>
  );
}