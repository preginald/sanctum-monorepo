import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import Loading from '../components/ui/Loading';
import Card from '../components/ui/Card';
import { invoiceStatusStyles } from '../lib/statusStyles';
import { formatCurrency } from '../lib/formatters';
import { FileText, DollarSign, AlertCircle } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'draft',   label: 'Draft' },
  { key: 'sent',    label: 'Sent' },
  { key: 'paid',    label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'void',    label: 'Void' },
];

function formatDate(str) {
  if (!str) return <span className="opacity-30">—</span>;
  return new Date(str).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Invoices() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { fetchData(); }, [refreshKey]);

  const fetchData = async () => {
    try {
      const res = await api.get('/invoices');
      setInvoices(res.data.invoices || []);
    } catch (e) {
      console.error(e);
      addToast('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = activeTab === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === activeTab);

  const totalValue = filtered.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  // Tab counts
  const countFor = (key) => key === 'all'
    ? invoices.length
    : invoices.filter(inv => inv.status === key).length;

  if (loading) {
    return (
      <Layout title="Invoices" onRefresh={() => setRefreshKey(prev => prev + 1)}>
        <Loading message="Loading invoices..." />
      </Layout>
    );
  }

  return (
    <Layout
      title="Invoices"
      subtitle="All client invoices"
      onRefresh={() => setRefreshKey(prev => prev + 1)}
    >
      {/* FILTER TABS */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-800 pb-0">
        {STATUS_TABS.map(tab => {
          const count = countFor(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-sanctum-gold text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-sanctum-gold/20 text-sanctum-gold' : 'bg-slate-800 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUMMARY BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Invoices</div>
            <div className="text-xl font-bold text-white">{filtered.length}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <DollarSign size={16} className="text-green-400" />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Total Value</div>
            <div className="text-xl font-bold text-white">{formatCurrency(totalValue)}</div>
          </div>
        </Card>
        {activeTab === 'all' && (
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertCircle size={16} className="text-red-400" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Overdue</div>
              <div className="text-xl font-bold text-white">
                {invoices.filter(inv => inv.status === 'overdue').length}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* TABLE */}
      <Card className="overflow-hidden p-0">
        <Table className="w-full text-left">
          <TableHeader className="text-xs uppercase bg-black/20 text-slate-400 font-bold tracking-wider">
            <TableRow>
              <TableHead className="p-4">Client</TableHead>
              <TableHead className="p-4">Status</TableHead>
              <TableHead className="p-4 text-right">Total</TableHead>
              <TableHead className="p-4">Due Date</TableHead>
              <TableHead className="p-4">Generated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm text-white divide-y divide-slate-800">
            {filtered.map(inv => (
              <TableRow
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="hover:bg-white/5 cursor-pointer transition-colors"
              >
                <TableCell className="p-4 font-bold">{inv.account_name}</TableCell>
                <TableCell className="p-4">
                  <span className={invoiceStatusStyles[inv.status] || invoiceStatusStyles.draft}>
                    {inv.status}
                  </span>
                </TableCell>
                <TableCell className="p-4 text-right font-mono">
                  {formatCurrency(inv.total_amount)}
                </TableCell>
                <TableCell className="p-4 text-slate-300">
                  {formatDate(inv.due_date)}
                </TableCell>
                <TableCell className="p-4 text-slate-400">
                  {formatDate(inv.generated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-slate-500 text-sm">No {activeTab === 'all' ? '' : activeTab} invoices found.</p>
          </div>
        )}
      </Card>
    </Layout>
  );
}
