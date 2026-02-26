import React, { useEffect, useState } from 'react';
import { DollarSign, Briefcase, Activity, Ticket, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import UpcomingRenewals from './UpcomingRenewals';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    revenue_realized: 0, pipeline_value: 0, active_audits: 0, 
    open_tickets: 0, critical_tickets: 0
  });

  useEffect(() => {
    api.get('/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon size={100} />
      </div>
      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">{title}</h3>
      <div className={`text-3xl font-mono font-bold text-white`}>{value}</div>
      {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Revenue (YTD)" value={formatCurrency(stats.revenue_realized)} icon={DollarSign} color="text-green-500" />
        <StatCard title="Pipeline" value={formatCurrency(stats.pipeline_value)} icon={Briefcase} color="text-blue-500" />
        <StatCard title="Active Audits" value={stats.active_audits} icon={Activity} color="text-purple-500" />
        <StatCard 
            title="Critical Issues" 
            value={stats.critical_tickets} 
            icon={AlertCircle} 
            color="text-red-500" 
            subtext={`${stats.open_tickets} total open tickets`}
        />
      </div>
      <UpcomingRenewals />
    </div>
  );
}