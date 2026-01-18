import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, CheckCircle } from 'lucide-react';
import api from '../../lib/api';
import TicketList from '../tickets/TicketList';
import TicketCreateModal from '../tickets/TicketCreateModal';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../lib/formatters';

export default function ClientDashboard({ user }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [data, setData] = useState({ account: {}, open_tickets: [], invoices: [], projects: [] });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
      try {
          const res = await api.get('/portal/dashboard');
          setData(res.data);
      } catch(e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      
      {/* WELCOME BANNER */}
      <div className="bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-8 flex justify-between items-center">
          <div>
              <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user.full_name}</h1>
              <p className="text-blue-200">
                  {data.account.name} • Security Score: <span className="font-mono font-bold text-white">{data.security_score}</span>
              </p>
          </div>
          <button 
            onClick={() => setShowCreate(true)} 
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center gap-2 transition-transform hover:-translate-y-1"
          >
              <Plus size={20} /> Request Support
          </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: TICKETS */}
          <div className="lg:col-span-2 space-y-6">
              <TicketList 
                  title="My Active Tickets" 
                  tickets={data.open_tickets} 
                  onAdd={() => setShowCreate(true)}
                  // Clients generally cannot delete tickets, only resolve them via interaction
              />

              {/* PROJECTS (If any) */}
              {data.projects.length > 0 && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                      <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 mb-4">Active Projects</h3>
                      <div className="space-y-3">
                          {data.projects.map(p => (
                              <div key={p.id} className="p-4 bg-black/20 rounded border border-white/5 flex justify-between items-center">
                                  <div>
                                      <div className="font-bold text-white">{p.name}</div>
                                      <div className="text-xs opacity-50">Due: {formatDate(p.due_date)}</div>
                                  </div>
                                  <div className="text-xs bg-slate-700 px-2 py-1 rounded uppercase font-bold text-slate-300">{p.status}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* RIGHT: INVOICES */}
          <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <FileText size={16}/> Outstanding Invoices
                  </h3>
                  <div className="space-y-3">
                      {data.invoices.filter(i => i.status !== 'paid').map(inv => (
                          <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="p-3 bg-black/20 rounded border border-red-500/20 hover:border-red-500/50 cursor-pointer transition-colors group">
                              <div className="flex justify-between mb-1">
                                  <span className="font-mono text-xs opacity-50">#{inv.id.slice(0,8)}</span>
                                  <span className="text-red-400 font-bold text-xs uppercase">{inv.status}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                  <div className="text-xs text-slate-400">Due: {formatDate(inv.due_date)}</div>
                                  <div className="font-mono font-bold text-white group-hover:text-red-300">{formatCurrency(inv.total_amount)}</div>
                              </div>
                          </div>
                      ))}
                      {data.invoices.filter(i => i.status !== 'paid').length === 0 && (
                          <div className="text-center p-6 opacity-30">
                              <CheckCircle size={32} className="mx-auto mb-2"/>
                              <p className="text-sm">All caught up!</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

      </div>

      <TicketCreateModal 
          isOpen={showCreate} 
          onClose={() => setShowCreate(false)} 
          onSuccess={() => { fetchData(); addToast("Request Submitted", "success"); }}
          preselectedAccountId={user.account_id} // Lock to their account
      />
    </div>
  );
}