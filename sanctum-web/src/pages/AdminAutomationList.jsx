import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import api from '../lib/api';
import { Loader2, Plus, Zap, PlayCircle, PauseCircle, Edit2, Trash2, Activity, FileText, LayoutGrid } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import AutomationModal from '../components/automations/AutomationModal';

export default function AdminAutomationList() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'logs'
  
  // RULES STATE
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // LOGS STATE
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // MODAL STATE
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', event_type: 'ticket_created', action_type: 'send_email', config: {}, is_active: true });
  const [saving, setSaving] = useState(false);

  // CONFIRM STATE
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  useEffect(() => { 
      fetchRules(); 
  }, []);

  useEffect(() => {
      if (activeTab === 'logs') fetchLogs();
  }, [activeTab]);

  const fetchRules = async () => {
      try {
          const res = await api.get('/admin/automations');
          setRules(res.data);
      } catch(e) { console.error(e); } 
      finally { setLoading(false); }
  };

  const fetchLogs = async () => {
      setLogsLoading(true);
      try {
          // Default limit 100
          const res = await api.get('/admin/automations/logs?limit=100');
          setLogs(res.data);
      } catch(e) { console.error("Failed to load logs", e); }
      finally { setLogsLoading(false); }
  };

  const handleSave = async (payload) => {
      setSaving(true);
      try {
          if (payload.id) await api.put(`/admin/automations/${payload.id}`, payload);
          else await api.post('/admin/automations', payload);
          
          addToast("Automation saved", "success");
          setShowModal(false);
          fetchRules();
      } catch(e) { addToast("Failed to save", "danger"); }
      finally { setSaving(false); }
  };

  const toggleStatus = async (rule) => {
      try {
          await api.put(`/admin/automations/${rule.id}`, { is_active: !rule.is_active });
          // Optimistic update
          setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
          addToast(rule.is_active ? "Rule Paused" : "Rule Activated", "info");
      } catch(e) { addToast("Failed to toggle", "danger"); }
  };

  const handleDelete = async (id) => {
      try {
          await api.delete(`/admin/automations/${id}`);
          addToast("Rule deleted", "info");
          fetchRules();
      } catch(e) { addToast("Failed to delete", "danger"); }
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout
      title="The Weaver"
      subtitle="Event-driven workflows and triggers"
      actions={activeTab === 'rules' ? (
        <button onClick={() => { setForm({ name: '', event_type: 'ticket_created', action_type: 'send_email', config: {}, is_active: true }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 font-bold rounded shadow-lg hover:bg-yellow-500 transition-colors text-sm">
          <Plus size={18} /> New Rule
        </button>
      ) : null}
    >
      <ConfirmationModal isOpen={confirm.isOpen} onClose={() => setConfirm({...confirm, isOpen: false})} title={confirm.title} message={confirm.message} onConfirm={confirm.action} isDangerous={true} />
      
      <AutomationModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSubmit={handleSave} 
        loading={saving} 
        form={form} 
        setForm={setForm}
      />

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-700 mb-6">
          <button 
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-2 flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'rules' ? 'border-sanctum-gold text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
              <LayoutGrid size={16} /> Workflow Rules
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-2 flex items-center gap-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'logs' ? 'border-sanctum-gold text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
              <FileText size={16} /> Global Execution Logs
          </button>
      </div>

      {/* CONTENT: RULES */}
      {activeTab === 'rules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
              {rules.map(rule => (
                  <div key={rule.id} className={`p-6 rounded-xl border transition-all ${rule.is_active ? 'bg-slate-900 border-purple-500/30 shadow-lg' : 'bg-slate-900/50 border-slate-800 opacity-70'}`}>
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                              <Activity size={16} className={rule.is_active ? "text-purple-400" : "text-slate-600"} />
                              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{rule.event_type.replace('_', ' ')}</span>
                          </div>
                          <div className="flex gap-1">
                              <button onClick={() => toggleStatus(rule)} className={`p-1.5 rounded ${rule.is_active ? 'text-green-400 hover:bg-green-900/20' : 'text-slate-500 hover:text-white'}`}>
                                  {rule.is_active ? <PauseCircle size={18}/> : <PlayCircle size={18}/>}
                              </button>
                              <button onClick={() => { setForm(rule); setShowModal(true); }} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10"><Edit2 size={16}/></button>
                              <button onClick={() => setConfirm({ isOpen: true, title: "Delete Rule?", message: "This cannot be recovered.", action: () => handleDelete(rule.id) })} className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-900/20"><Trash2 size={16}/></button>
                          </div>
                      </div>
                      
                      <h3 className="font-bold text-white text-lg mb-1">{rule.name}</h3>
                      <p className="text-xs text-slate-400 mb-4 h-8 line-clamp-2">{rule.description || "No description provided."}</p>
                      
                      <div className="bg-black/30 p-3 rounded border border-white/5 font-mono text-[10px] text-slate-300">
                          <span className="text-purple-400 font-bold">ACTION:</span> {rule.action_type.toUpperCase()}
                      </div>
                  </div>
              ))}
              
              {rules.length === 0 && (
                  <div className="col-span-full text-center py-12 opacity-30">
                      <Zap size={48} className="mx-auto mb-4"/>
                      <p>No active automations. Create one to start weaving.</p>
                  </div>
              )}
          </div>
      )}

      {/* CONTENT: LOGS */}
      {activeTab === 'logs' && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              {logsLoading ? (
                  <div className="p-12 text-center text-slate-500">
                      <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                      <p>Loading the Weave...</p>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                      <Table className="w-full text-left text-sm text-slate-400">
                          <TableHeader className="bg-slate-950 text-slate-500 uppercase text-xs">
                              <TableRow>
                                  <TableHead className="p-4 w-40">Timestamp</TableHead>
                                  <TableHead className="p-4 w-64">Rule</TableHead>
                                  <TableHead className="p-4 w-32">Status</TableHead>
                                  <TableHead className="p-4">Output</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-slate-800">
                              {logs.length > 0 ? logs.map(log => (
                                  <TableRow key={log.id} className="hover:bg-white/5 transition-colors">
                                      <TableCell className="p-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                          {new Date(log.triggered_at).toLocaleString()}
                                      </TableCell>
                                      <TableCell className="p-4 font-medium text-white">
                                          {log.automation_name || <span className="opacity-30 italic">Unknown Rule</span>}
                                      </TableCell>
                                      <TableCell className="p-4">
                                          <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                              log.status === 'success' ? 'bg-green-500/10 text-green-400' : 
                                              log.status === 'failure' ? 'bg-red-500/10 text-red-400' : 
                                              'bg-yellow-500/10 text-yellow-400'
                                          }`}>
                                              {log.status}
                                          </span>
                                      </TableCell>
                                      <TableCell className="p-4 max-w-lg">
                                          <div className="font-mono text-xs text-slate-300 truncate hover:whitespace-normal break-words" title={log.output}>
                                              {log.output}
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              )) : (
                                  <TableRow>
                                      <TableCell colSpan="4" className="p-8 text-center opacity-30 italic">
                                          No execution history found.
                                      </TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </div>
              )}
          </div>
      )}

    </Layout>
  );
}