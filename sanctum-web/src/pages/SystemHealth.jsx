import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Loader2, Activity, Database, HardDrive, Cpu, GitBranch, RefreshCw, Server, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function SystemHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/health');
      setData(res.data);
      setLastRefreshed(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Status Colors
  const getStatusColor = (status) => {
      if (status === 'critical' || status === 'error') return 'text-red-500 bg-red-500/10 border-red-500/20';
      if (status === 'degraded' || status === 'warning') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  if (!data && loading) return <Layout title="System Health"><div className="flex justify-center p-20"><Loader2 className="animate-spin text-sanctum-gold" size={48} /></div></Layout>;

  return (
    <Layout title="System Watchtower">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* TOP HEADER */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-full border flex items-center gap-2 uppercase text-sm font-bold tracking-widest ${getStatusColor(data?.status)}`}>
                    <Activity size={16} /> System {data?.status}
                </div>
                <span className="text-slate-500 text-xs font-mono">
                    Version: <span className="text-white">{data?.version}</span>
                </span>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 text-sm text-sanctum-gold hover:text-white transition-colors">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
        </div>

        {/* VITALS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* DB LATENCY */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-slate-800 group-hover:text-slate-700 transition-colors"><Database size={100} /></div>
                <div className="relative z-10">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Database Latency</h3>
                    <div className={`text-3xl font-mono font-bold ${data?.database?.latency_ms > 100 ? 'text-yellow-500' : 'text-green-400'}`}>
                        {data?.database?.latency_ms}ms
                    </div>
                </div>
            </div>

            {/* DISK USAGE */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-slate-800 group-hover:text-slate-700 transition-colors"><HardDrive size={100} /></div>
                <div className="relative z-10">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Disk Usage</h3>
                    <div className={`text-3xl font-mono font-bold ${data?.system?.disk_percent > 90 ? 'text-red-500' : 'text-blue-400'}`}>
                        {data?.system?.disk_percent}%
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{data?.system?.disk_free_gb} GB Free</p>
                </div>
            </div>

            {/* CPU LOAD */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-slate-800 group-hover:text-slate-700 transition-colors"><Cpu size={100} /></div>
                <div className="relative z-10">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">CPU Load</h3>
                    <div className="text-3xl font-mono font-bold text-white">
                        {data?.system?.cpu_percent}%
                    </div>
                </div>
            </div>

            {/* MEMORY */}
            <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-slate-800 group-hover:text-slate-700 transition-colors"><Server size={100} /></div>
                <div className="relative z-10">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">RAM Usage</h3>
                    <div className="text-3xl font-mono font-bold text-white">
                        {data?.system?.memory_percent}%
                    </div>
                </div>
            </div>
        </div>

        {/* DETAILED CHECKS TABLE */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Activity size={18} className="text-sanctum-gold"/> Diagnostic Log
                </h3>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-black/20 text-slate-500 uppercase text-xs font-bold">
                    <tr>
                        <th className="px-6 py-3">Component</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Latency</th>
                        <th className="px-6 py-3">Message</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {data?.checks?.map((check, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-3 font-bold text-white">{check.name}</td>
                            <td className="px-6 py-3">
                                {check.status === 'ok' ? (
                                    <span className="flex items-center gap-2 text-green-500"><CheckCircle size={14}/> OK</span>
                                ) : (
                                    <span className="flex items-center gap-2 text-red-500"><AlertTriangle size={14}/> {check.status.toUpperCase()}</span>
                                )}
                            </td>
                            <td className="px-6 py-3 font-mono opacity-70">{check.latency || '-'}</td>
                            <td className="px-6 py-3 text-slate-400">{check.message}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-2 bg-black/40 text-center text-xs text-slate-600 font-mono">
                Execution Time: {data?.execution_time_ms}ms
            </div>
        </div>

      </div>
    </Layout>
  );
}