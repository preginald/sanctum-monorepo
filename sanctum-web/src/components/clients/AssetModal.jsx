import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2, RefreshCw, Smartphone, Monitor, Server, Globe, Shield, Printer, Key, Disc, Tablet } from 'lucide-react';
import { ASSET_TYPES, ASSET_STATUSES } from '../../lib/constants';
import { 
    SPEC_FIELDS, 
    getAssetPlaceholder, 
    getVendorLabel, 
    getVendorPlaceholder, 
    isLifecycleAsset 
} from '../../lib/assetUtils';
import api from '../../lib/api';
import SearchableSelect from '../ui/SearchableSelect';

export default function AssetModal({ isOpen, onClose, onSubmit, loading, form, setForm }) {
  const [catalog, setCatalog] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  
  // Logic: Is this a "Lifecycle" asset? (Needs expiry, billing, vendor)
  const isLifecycle = isLifecycleAsset(form.asset_type);
  
  // Logic: Does this asset have custom specs?
  const activeSpecs = SPEC_FIELDS[form.asset_type] || [];

  // Load Catalog + Vendors
  useEffect(() => {
      if (isOpen) {
          api.get('/products').then(res => {
              setCatalog(res.data.filter(p => p.is_recurring));
          });
          api.get('/vendors').then(res => {
              setVendors(res.data.map(v => ({ id: v.name, title: v.name, subtitle: v.website || '' })));
          });
      }
  }, [isOpen]);

  const handleSpecChange = (key, value) => {
      setForm(prev => ({
          ...prev,
          specs: {
              ...prev.specs,
              [key]: value
          }
      }));
  };

  // Helper to determine icon
  const getIcon = () => {
      if (['domain', 'hosting web', 'hosting email'].includes(form.asset_type)) return <Globe size={20} className="text-purple-400" />;
      if (['iphone', 'android phone'].includes(form.asset_type)) return <Smartphone size={20} className="text-green-400" />;
      if (['ipad', 'android tablet'].includes(form.asset_type)) return <Tablet size={20} className="text-green-400" />;
      if (['server', 'network', 'firewall'].includes(form.asset_type)) return <Server size={20} className="text-orange-400" />;
      if (form.asset_type === 'printer') return <Printer size={20} className="text-slate-400" />;
      if (form.asset_type === 'security software') return <Shield size={20} className="text-red-400" />;
      if (form.asset_type === 'license') return <Key size={20} className="text-yellow-400" />;
      if (form.asset_type === 'software' || form.asset_type === 'saas') return <Disc size={20} className="text-blue-300" />;
      return <Monitor size={20} className="text-blue-400" />;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
        <div className="flex items-center gap-2">
            {getIcon()}
            {form.id ? "Edit Asset" : "Deploy Asset"}
        </div>
    }>
        <form onSubmit={onSubmit} className="flex flex-col h-full">
            
            {/* SCROLLABLE BODY */}
            <div className="space-y-4 overflow-y-auto max-h-[65vh] pr-2 -mr-2 custom-scrollbar p-1">
                
                {/* ROW 1: CONTEXT (Type & Status) */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Asset Type</label>
                        <SearchableSelect
                            items={ASSET_TYPES.map(t => ({ id: t, title: capitalize(t) }))}
                            selectedIds={[form.asset_type]}
                            onSelect={(item) => setForm({...form, asset_type: item.id, specs: {}})}
                            placeholder="Search asset type..."
                            labelKey="title"
                            displaySelected
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                        <select 
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white capitalize focus:border-sanctum-blue outline-none" 
                            value={form.status} 
                            onChange={e => setForm({...form, status: e.target.value})}
                        >
                            {ASSET_STATUSES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
                        </select>
                    </div>
                </div>

                {/* ROW 2: IDENTITY */}
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Asset Name</label>
                    <input 
                        required 
                        className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-sanctum-blue outline-none text-lg font-medium placeholder:text-slate-600" 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                        placeholder={getAssetPlaceholder(form.asset_type)} 
                    />
                </div>

                {/* --- DYNAMIC SPECS SECTION --- */}
                {activeSpecs.length > 0 && (
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 space-y-3">
                        <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest border-b border-blue-500/10 pb-2 mb-2">
                            <Monitor size={12}/> Asset Intelligence
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {activeSpecs.map((field) => (
                                <div key={field.key} className={['role', 'admin_url', 'url', 'management_url'].includes(field.key) ? 'col-span-2' : ''}>
                                    <label className="text-xs text-slate-400 block mb-1">{field.label}</label>
                                    <input 
                                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-blue-500 outline-none transition-colors"
                                        value={form.specs?.[field.key] || ''}
                                        onChange={(e) => handleSpecChange(field.key, e.target.value)}
                                        placeholder={field.placeholder}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        {/* Show standard Serial Number for Hardware assets only */}
                        {!isLifecycle && (
                            <div className="mt-2">
                                <label className="text-xs text-slate-400 block mb-1">Serial Number / Service Tag</label>
                                <input 
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm tracking-wide" 
                                    value={form.serial_number || ''} 
                                    onChange={e => setForm({...form, serial_number: e.target.value})} 
                                    placeholder="Required for warranty lookup" 
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* --- LIFECYCLE & BILLING SECTION --- */}
                {isLifecycle && (
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-purple-500/20 space-y-4">
                        <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest border-b border-purple-500/10 pb-2">
                            <RefreshCw size={12}/> Lifecycle & Billing
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Expiry Date</label>
                                <input 
                                    type="date" 
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm" 
                                    value={form.expires_at || ''} 
                                    onChange={e => setForm({...form, expires_at: e.target.value})} 
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">{getVendorLabel(form.asset_type)}</label>
                                <SearchableSelect
                                    items={vendors}
                                    selectedIds={form.vendor ? [form.vendor] : []}
                                    onSelect={(item) => setForm({...form, vendor: item ? item.id : ''})}
                                    placeholder={getVendorPlaceholder(form.asset_type)}
                                    labelKey="title"
                                    subLabelKey="subtitle"
                                    displaySelected
                                    allowCreate
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Linked Service (Catalog)</label>
                            <select 
                                className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-sm" 
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
                        
                        {/* Security Software: Show License Key here if it's lifecycle based */}
                        {(form.asset_type === 'software' || form.asset_type === 'license') && (
                             <div className="mt-2">
                                <label className="text-xs text-slate-400 block mb-1">License / Product Key</label>
                                <input 
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm tracking-wide" 
                                    value={form.serial_number || ''} 
                                    onChange={e => setForm({...form, serial_number: e.target.value})} 
                                    placeholder="XXXX-XXXX-XXXX-XXXX" 
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* --- LEGACY FALLBACK --- */}
                {/* If no specs and not lifecycle (e.g. unknown hardware), show basic fields */}
                {!isLifecycle && !activeSpecs.length && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs opacity-50 block mb-1">IP Address</label>
                            <input className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm" value={form.ip_address || ''} onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.x.x" />
                        </div>
                        <div>
                            <label className="text-xs opacity-50 block mb-1">Serial / Key</label>
                            <input className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-sm" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="XYZ-123" />
                        </div>
                    </div>
                )}

                <div>
                    <label className="text-xs opacity-50 block mb-1">Notes</label>
                    <textarea className="w-full p-2 h-20 bg-slate-900 border border-slate-700 rounded text-white text-sm focus:border-sanctum-blue outline-none resize-none" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional context, location, assigned user..." />
                </div>
            </div>

            {/* FIXED FOOTER */}
            <div className="pt-4 mt-2 border-t border-slate-700/50">
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20">
                    {loading && <Loader2 className="animate-spin" size={16}/>} 
                    {form.id ? 'Update Asset' : 'Deploy Asset'}
                </button>
            </div>
        </form>
    </Modal>
  );
}