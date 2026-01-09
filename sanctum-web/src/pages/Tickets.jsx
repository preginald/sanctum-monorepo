import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, AlertCircle, CheckCircle, Clock, Bug, Zap, Clipboard, LifeBuoy } from 'lucide-react';
import api from '../lib/api';

export default function Tickets() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Create Form
  const [form, setForm] = useState({ account_id: '', subject: '', priority: 'normal', ticket_type: 'support' });

  const isNaked = user?.scope === 'nt_only';
  const theme = {
    btn: isNaked ? "bg-naked-pink hover:bg-pink-600" : "bg-sanctum-blue hover:bg-blue-600",
    header: isNaked ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-sanctum-gold"
  };

  useEffect(() => { fetchData(); }, [token]);

  const fetchData = async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        api.get('/tickets'),
        api.get('/accounts')
      ]);
      setTickets(tRes.data);
      setClients(cRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const createTicket = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tickets', form);
      setShowModal(false);
      setForm({ account_id: '', subject: '', priority: 'normal', ticket_type: 'support' });
      fetchData();
    } catch (e) { alert("Error creating ticket"); }
  };

  const updateStatus = async (e, id, newStatus) => {
    e.stopPropagation(); 
    try {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
      await api.put(`/tickets/${id}`, { status: newStatus });
    } catch (e) { fetchData(); }
  };

  // ICON HELPER
  const getTypeIcon = (type) => {
      switch(type) {
          case 'bug': return <Bug size={16} className="text-red-400" />;
          case 'feature': return <Zap size={16} className="text-yellow-400" />;
          case 'task': return <Clipboard size={16} className="text-blue-400" />;
          default: return <LifeBuoy size={16} className="text-slate-400" />;
      }
  };

  return (
    <Layout title="Service Desk">
      <div className="flex justify-end mb-6">
        <button onClick={() => setShowModal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white shadow-lg ${theme.btn}`}>
          <Plus size={18} /> New Ticket
        </button>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className={`text-xs uppercase ${theme.header}`}>
            <tr>
              <th className="p-4 w-16">Type</th>
              <th className="p-4">ID</th>
              <th className="p-4">Client</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {tickets.map(t => (
              <tr 
                key={t.id} 
                onClick={() => navigate(`/tickets/${t.id}`)} 
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <td className="p-4" title={t.ticket_type.toUpperCase()}>
                    {getTypeIcon(t.ticket_type)}
                </td>
                <td className="p-4 font-mono opacity-50">#{t.id}</td>
                <td className="p-4 font-bold">{t.account_name}</td>
                <td className="p-4">
                    {t.subject}
                    {t.milestone_name && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-900/50 text-[10px] text-blue-300 border border-blue-800">
                            {t.milestone_name}
                        </span>
                    )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                    t.priority === 'critical' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {t.priority}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase ${
                    t.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {t.status !== 'resolved' && (
                    <button 
                      onClick={(e) => updateStatus(e, t.id, 'resolved')} 
                      className="text-green-500 hover:underline text-xs"
                    >
                      Quick Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && !loading && <div className="p-8 text-center opacity-50">No tickets found.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
            <h2 className="text-xl font-bold mb-4 text-white">Create Ticket</h2>
            <form onSubmit={createTicket} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Client</label>
                <select required className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                  <option value="">Select...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Type</label>
                    <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.ticket_type} onChange={e => setForm({...form, ticket_type: e.target.value})}>
                        <option value="support">Support</option>
                        <option value="bug">Bug Report</option>
                        <option value="feature">Feature Request</option>
                        <option value="task">Internal Task</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Priority</label>
                    <select className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                  </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Subject</label>
                <input required className="w-full p-2 rounded bg-black/20 border border-slate-700 text-white" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Printer Offline" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 bg-slate-700 rounded text-white">Cancel</button>
                <button type="submit" className={`flex-1 py-2 rounded text-white font-bold ${theme.btn}`}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}