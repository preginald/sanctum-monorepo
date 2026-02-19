import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { CheckCircle, XCircle, Activity, Server, Database, HardDrive, RefreshCw, Megaphone, Ticket, Receipt, Briefcase, Users } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

// UI Components
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';

export default function Diagnostics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState(null);
  const { addToast } = useToast();

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/health');
      setReport(res.data);
      setLastRun(new Date());
      addToast("System self-test complete", "success");
    } catch (e) {
      console.error(e);
      setReport({ status: 'critical', checks: [{ name: 'API Reachability', status: 'error', message: 'Backend Offline (500/404)' }] });
      addToast("System self-test failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runDiagnostics(); }, []);

  const getIcon = (name) => {
    if (name.includes('PostgreSQL')) return <Database size={18} />;
    if (name.includes('Storage')) return <HardDrive size={18} />;
    if (name.includes('Schema')) return <Server size={18} />;
    if (name.includes('Campaign')) return <Megaphone size={18} />;
    if (name.includes('Ticket')) return <Ticket size={18} />;
    if (name.includes('Invoice')) return <Receipt size={18} />;
    if (name.includes('Project')) return <Briefcase size={18} />;
    if (name.includes('Client') || name.includes('Account')) return <Users size={18} />;
    return <Activity size={18} />;
  };

  if (loading && !report) {
      return (
          <Layout title="System Diagnostics">
              <Loading message="Running System Self-Test..." />
          </Layout>
      );
  }

  return (
    <Layout title="System Diagnostics">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Status: 
            {report && (
              <Badge variant={report.status === 'nominal' ? 'success' : 'danger'}>
                {report.status}
              </Badge>
            )}
          </h2>
          <p className="text-sm opacity-50">
            Last Check: {lastRun ? lastRun.toLocaleTimeString() : 'Pending...'}
          </p>
        </div>
        <Button 
          onClick={runDiagnostics} 
          disabled={loading}
          icon={RefreshCw}
          variant="primary"
          className={loading ? "opacity-80" : ""}
        >
          {loading ? 'Running...' : 'Run Self-Test'}
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <Table className="w-full text-left">
          <TableHeader className="bg-black/20 text-xs uppercase text-slate-400 font-bold tracking-wider">
            <TableRow>
              <TableHead className="p-4 w-12"></TableHead>
              <TableHead className="p-4">Component</TableHead>
              <TableHead className="p-4">Result</TableHead>
              <TableHead className="p-4 text-right">Latency / Meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm text-white divide-y divide-slate-800">
            {report?.checks.map((check, idx) => (
              <TableRow key={idx} className="hover:bg-white/5 transition-colors">
                <TableCell className="p-4">
                  {check.status === 'ok' ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : (
                    <XCircle className="text-red-500" size={20} />
                  )}
                </TableCell>
                <TableCell className="p-4 font-bold flex items-center gap-3">
                  <span className="opacity-50">{getIcon(check.name)}</span>
                  {check.name}
                </TableCell>
                <TableCell className="p-4">
                  <span className={check.status === 'ok' ? 'text-green-400 font-bold text-xs uppercase' : 'text-red-400 font-bold text-xs uppercase'}>
                    {check.status === 'ok' ? 'OPERATIONAL' : 'FAILURE'}
                  </span>
                </TableCell>
                <TableCell className="p-4 text-right font-mono opacity-50 text-xs">
                  {check.message}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!report && <div className="p-8 text-center opacity-50">Initializing Protocols...</div>}
      </Card>
    </Layout>
  );
}
