import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Loader2, CheckCircle, XCircle, Activity, Server, Database, HardDrive, RefreshCw } from 'lucide-react';
import api from '../lib/api';

export default function Diagnostics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState(null);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/health');
      setReport(res.data);
      setLastRun(new Date());
    } catch (e) {
      console.error(e);
      setReport({ status: 'critical', checks: [{ name: 'API Reachability', status: 'error', message: 'Backend Offline (500/404)' }] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runDiagnostics(); }, []);

  const getIcon = (name) => {
    if (name.includes('PostgreSQL')) return <Database size={18} />;
    if (name.includes('Storage')) return <HardDrive size={18} />;
    if (name.includes('Schema')) return <Server size={18} />;
    return <Activity size={18} />;
  };

  return (
    <Layout title="System Diagnostics">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Status: 
            {!loading && report && (
              <span className={`uppercase px-2 py-1 rounded text-sm ${report.status === 'nominal' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {report.status}
              </span>
            )}
          </h2>
          <p className="text-sm opacity-50">
            Last Check: {lastRun ? lastRun.toLocaleTimeString() : 'Pending...'}
          </p>
        </div>
        <button 
          onClick={runDiagnostics} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sanctum-blue hover:bg-blue-600 rounded text-white font-bold disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Run Self-Test
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-xs uppercase text-slate-400">
            <tr>
              <th className="p-4 w-12"></th>
              <th className="p-4">Component</th>
              <th className="p-4">Result</th>
              <th className="p-4 text-right">Latency / Meta</th>
            </tr>
          </thead>
          <tbody className="text-sm text-white">
            {report?.checks.map((check, idx) => (
              <tr key={idx} className="border-b border-slate-800 hover:bg-white/5 transition-colors">
                <td className="p-4">
                  {check.status === 'ok' ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : (
                    <XCircle className="text-red-500" size={20} />
                  )}
                </td>
                <td className="p-4 font-bold flex items-center gap-3">
                  <span className="opacity-50">{getIcon(check.name)}</span>
                  {check.name}
                </td>
                <td className="p-4">
                  <span className={check.status === 'ok' ? 'text-green-400' : 'text-red-400 font-mono'}>
                    {check.status === 'ok' ? 'OPERATIONAL' : 'FAILURE'}
                  </span>
                </td>
                <td className="p-4 text-right font-mono opacity-50 text-xs">
                  {check.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && !report && <div className="p-8 text-center opacity-50">Initializing Protocols...</div>}
      </div>
    </Layout>
  );
}