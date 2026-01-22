import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2 } from 'lucide-react';

export default function AutomationModal({ isOpen, onClose, onSubmit, loading, form, setForm }) {
  // Local state for the JSON string to avoid object binding issues during typing
  const [configString, setConfigString] = useState('{}');

  useEffect(() => {
      if (isOpen) {
          setConfigString(JSON.stringify(form.config || {}, null, 2));
      }
  }, [isOpen, form]);

  const handleSubmit = (e) => {
      e.preventDefault();
      try {
          const parsedConfig = JSON.parse(configString);
          onSubmit({ ...form, config: parsedConfig });
      } catch (err) {
          alert("Invalid JSON in Config field");
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={form.id ? "Edit Rule" : "New Automation"}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-xs opacity-50 block mb-1">Rule Name</label>
                <input required autoFocus className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Notify Admin on New Ticket" />
            </div>
            
            <div>
                <label className="text-xs opacity-50 block mb-1">Description</label>
                <input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs opacity-50 block mb-1">Trigger Event</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}>
                        <option value="ticket_created">Ticket Created</option>
                        <option value="ticket_resolved">Ticket Resolved</option>
                        <option value="deal_won">Deal Won</option>
                        <option value="invoice_overdue">Invoice Overdue</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs opacity-50 block mb-1">Action</label>
                    <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.action_type} onChange={e => setForm({...form, action_type: e.target.value})}>
                        <option value="send_email">Send Email</option>
                        <option value="log_info">Log Info (Debug)</option>
                        <option value="webhook">Call Webhook</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="text-xs opacity-50 block mb-1">Configuration (JSON)</label>
                <textarea 
                    className="w-full p-3 h-32 bg-slate-950 border border-slate-700 rounded text-green-400 font-mono text-xs" 
                    value={configString} 
                    onChange={e => setConfigString(e.target.value)} 
                    placeholder='{ "template": "alert", "target": "admin" }'
                />
            </div>

            <button type="submit" disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex justify-center items-center gap-2">
                {loading && <Loader2 className="animate-spin" size={16}/>} Save Rule
            </button>
        </form>
    </Modal>
  );
}