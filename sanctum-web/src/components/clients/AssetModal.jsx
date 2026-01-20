import React from 'react';
import Modal from '../ui/Modal';
import { Loader2 } from 'lucide-react';
import { ASSET_TYPES, ASSET_STATUSES } from '../../lib/constants';

export default function AssetModal({ isOpen, onClose, onSubmit, loading, form, setForm }) {
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={form.id ? "Edit Asset" : "Deploy Asset"}>
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <label className="text-xs opacity-50 block mb-1">Asset Name</label>
                <input required autoFocus className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. FILE-SRV-01" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs opacity-50 block mb-1">Type</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white capitalize" value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})}>
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs opacity-50 block mb-1">Status</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white capitalize" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                        {ASSET_STATUSES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs opacity-50 block mb-1">IP Address</label>
                    <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm" value={form.ip_address || ''} onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.x.x" />
                </div>
                <div>
                    <label className="text-xs opacity-50 block mb-1">Serial / Key</label>
                    <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white font-mono text-sm" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="XYZ-123" />
                </div>
            </div>

            <div>
                <label className="text-xs opacity-50 block mb-1">Notes</label>
                <textarea className="w-full p-2 h-20 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex justify-center items-center gap-2">
                {loading && <Loader2 className="animate-spin" size={16}/>} Save Asset
            </button>
        </form>
    </Modal>
  );
}