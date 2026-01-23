import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2, CheckCircle, XCircle, Clock, FileText, Settings, Activity } from 'lucide-react';
import api from '../../lib/api';
import { AUTOMATION_EVENTS, AUTOMATION_ACTIONS } from '../../lib/constants';

export default function AutomationModal({ isOpen, onClose, onSubmit, loading, form, setForm }) {
  const [configString, setConfigString] = useState('{}');
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'logs'
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
      if (isOpen) {
          setConfigString(JSON.stringify(form.config || {}, null, 2));
          setActiveTab('settings');
          setLogs([]); // Reset
      }
  }, [isOpen, form]);

  useEffect(() => {
      if (isOpen && activeTab === 'logs' && form.id) {
          fetchLogs();
      }
  }, [activeTab, isOpen]);

  const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
          const res = await api.get(`/admin/automations/${form.id}/logs`);
          setLogs(res.data);
      } catch (e) { console.error(e); }
      finally { setLoadingLogs(false); }
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      try {
          const parsedConfig = JSON.parse(configString);
          onSubmit({ ...form, config: parsedConfig });
      } catch (err) {
          alert("Invalid JSON in Config field");
      }
  };

  const getPlaceholder = () => {
        if (form.action_type === 'create_notification') {
            return '{ "target": "admin", "title": "Alert", "message": "Ticket created" }';
        }
        return '{ "template": "alert", "target": "admin" }';
    };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={form.id ? "Edit Rule" : "New Automation"}>
        
        {/* TABS */}
        {form.id && (
            <div className="flex gap-4 mb-6 border-b border-slate-700">
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'settings' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    <Settings size={14} /> Settings
                </button>
                <button 
                    onClick={() => setActiveTab('logs')}
                    className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'logs' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                >
                    <Activity size={14} /> Execution Logs
                </button>
            </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
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
                            {AUTOMATION_EVENTS.map(evt => (
                                <option key={evt.value} value={evt.value}>{evt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Action</label>
                        <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={form.action_type} onChange={e => setForm({...form, action_type: e.target.value})}>
                            {AUTOMATION_ACTIONS.map(act => (
                                <option key={act.value} value={act.value}>{act.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-xs opacity-50 block mb-1">Configuration (JSON)</label>
                    <textarea 
                        className="w-full p-3 h-32 bg-slate-950 border border-slate-700 rounded text-green-400 font-mono text-xs custom-scrollbar" 
                        value={configString} 
                        onChange={e => setConfigString(e.target.value)} 
                        placeholder={getPlaceholder()}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Check Wiki (SYS-016) for config schemas.</p>
                </div>

                <button type="submit" disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex justify-center items-center gap-2">
                    {loading && <Loader2 className="animate-spin" size={16}/>} Save Rule
                </button>
            </form>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
            <div className="h-[400px] overflow-y-auto custom-scrollbar bg-black/20 rounded border border-slate-700 p-2 space-y-2">
                {loadingLogs ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-purple-500"/></div>
                ) : logs.length === 0 ? (
                    <p className="text-center text-slate-500 text-xs italic p-4">No execution history found.</p>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="p-3 bg-slate-800 rounded border border-slate-700 text-xs">
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-bold flex items-center gap-1 uppercase ${log.status === 'success' ? 'text-green-400' : (log.status === 'failure' ? 'text-red-400' : 'text-blue-400')}`}>
                                    {log.status === 'success' ? <CheckCircle size={12}/> : (log.status === 'failure' ? <XCircle size={12}/> : <Loader2 size={12} className="animate-spin"/>)}
                                    {log.status}
                                </span>
                                <span className="text-slate-500 flex items-center gap-1">
                                    <Clock size={10}/> {new Date(log.triggered_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="font-mono text-slate-300 break-all pl-4 border-l-2 border-slate-700">
                                {log.output}
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
    </Modal>
  );
}
