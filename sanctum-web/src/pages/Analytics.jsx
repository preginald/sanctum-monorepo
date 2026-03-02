import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, TrendingUp, AlertTriangle, DollarSign, Clock, RefreshCw, Target } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../lib/formatters';

const KpiCard = ({ icon: Icon, iconColor, label, value, sub, onClick }) => (
  <div
    className={`bg-slate-900 border border-slate-700 rounded-xl p-5 ${onClick ? 'cursor-pointer hover:border-slate-500 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className={iconColor} />
      <span className="text-slate-400 text-sm">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
  </div>
);

const EmptyState = ({ message }) => (
  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">{message}</div>
);

export default function Analytics() {
  const [revenue, setRevenue] = useState([]);
  const [assets, setAssets] = useState([]);
  const [cashPosition, setCashPosition] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [recurring, setRecurring] = useState(null);
  const [budgetActual, setBudgetActual] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/analytics/revenue-trend'),
      api.get('/analytics/asset-reliability'),
      api.get('/analytics/cash-position'),
      api.get('/analytics/pipeline-forecast'),
      api.get('/analytics/recurring-revenue'),
      api.get('/analytics/budget-vs-actual'),
    ]).then(([revRes, assRes, cashRes, pipeRes, recRes, budRes]) => {
      setRevenue(revRes.data);
      setAssets(assRes.data);
      setCashPosition(cashRes.data);
      setPipeline(pipeRes.data);
      setRecurring(recRes.data);
      setBudgetActual(budRes.data);
      setLoading(false);
    });
  }, [refreshKey]);

  if (loading) return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="Loading...">
      <Loader2 className="animate-spin"/>
    </Layout>
  );

  const OVERDUE_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="The Oracle">

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={DollarSign}
          iconColor="text-red-400"
          label="Total Outstanding"
          value={formatCurrency(cashPosition?.total_outstanding || 0)}
          sub={cashPosition?.total_overdue > 0 ? `${formatCurrency(cashPosition.total_overdue)} overdue` : 'No overdue invoices'}
          onClick={() => navigate('/invoices')}
        />
        <KpiCard
          icon={RefreshCw}
          iconColor="text-blue-400"
          label="MRR"
          value={formatCurrency(recurring?.mrr || 0)}
          sub={`ARR ${formatCurrency(recurring?.arr || 0)}`}
        />
        <KpiCard
          icon={Clock}
          iconColor="text-purple-400"
          label="Pipeline (Unbilled)"
          value={formatCurrency(pipeline?.total || 0)}
          sub="Pending milestone billings"
        />
        <KpiCard
          icon={Target}
          iconColor="text-orange-400"
          label="Projects Tracked"
          value={budgetActual.length}
          sub="With budget set"
        />
      </div>

      {/* ROW 1 — Existing Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* REVENUE TREND */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="text-green-500"/> Revenue Trend (6 Months)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ASSET RELIABILITY */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <AlertTriangle className="text-orange-500"/> Most Problematic Assets
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assets} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                  cursor={{fill: '#1e293b'}}
                />
                <Bar dataKey="tickets" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ROW 2 — Financial Planning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* CASH POSITION */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="text-red-400"/> Cash Position (Aged Debt)
          </h3>
          {cashPosition?.buckets?.every(b => b.amount === 0) ? (
            <EmptyState message="No outstanding invoices" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashPosition?.buckets || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40}>
                    {cashPosition?.buckets?.map((_, i) => (
                      <Cell key={i} fill={OVERDUE_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* PIPELINE FORECAST */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="text-purple-400"/> Pipeline Forecast (Unbilled Milestones)
          </h3>
          {pipeline?.total === 0 ? (
            <EmptyState message="No unbilled milestones with billable amounts" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline?.buckets || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Bar dataKey="amount" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>

      {/* ROW 3 — MRR + Budget vs Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* RECURRING REVENUE BREAKDOWN */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <RefreshCw className="text-blue-400"/> Recurring Revenue Breakdown
          </h3>
          {!recurring?.breakdown?.length ? (
            <EmptyState message="No active recurring assets found" />
          ) : (
            <div className="space-y-3">
              {recurring.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm truncate flex-1 mr-4">{item.name}</span>
                  <span className="text-white font-mono text-sm">{formatCurrency(item.value)}/mo</span>
                </div>
              ))}
              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-slate-400 text-sm">Total MRR</span>
                <span className="text-blue-400 font-bold">{formatCurrency(recurring.mrr)}</span>
              </div>
            </div>
          )}
        </div>

        {/* BUDGET VS ACTUAL */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <Target className="text-orange-400"/> Budget vs Actual
          </h3>
          {!budgetActual.length ? (
            <EmptyState message="No projects with budgets set" />
          ) : (
            <div className="space-y-4">
              {budgetActual.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate flex-1 mr-2">{p.project}</span>
                    <span className={p.variance >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {p.variance >= 0 ? '+' : ''}{formatCurrency(p.variance)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${p.utilisation > 100 ? 'bg-red-500' : p.utilisation > 75 ? 'bg-orange-400' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(p.utilisation, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{formatCurrency(p.actual)} actual</span>
                    <span>{p.utilisation}% of {formatCurrency(p.budget)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </Layout>
  );
}
