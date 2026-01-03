import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout'; // Import the shell
import { Loader2 } from 'lucide-react';
import api from '../lib/api';

export default function Dashboard() {
  const { user, token } = useAuthStore();
  const [stats, setStats] = useState({ revenue_mtd: 0, active_audits: 0, open_tickets: 0 });
  const [loading, setLoading] = useState(true);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // Theme logic is now handled in Layout, we just need text colors for widgets
  const accent = isNaked ? 'text-naked-pink' : 'text-sanctum-gold';
  const widgetBg = isNaked ? "bg-white border-slate-200 shadow-sm" : "bg-slate-800 border-slate-700";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(response.data);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    if (token) fetchStats();
  }, [token]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  return (
    <Layout title="Command Center">
      {loading ? (
        <div className="flex items-center gap-2 opacity-50"><Loader2 className="animate-spin" /> Loading Intel...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {!isNaked && <Widget title="Revenue (MTD)" value={formatCurrency(stats.revenue_mtd)} bg={widgetBg} accent={accent} />}
          {!isNaked && <Widget title="Active Audits" value={stats.active_audits} bg={widgetBg} accent={accent} />}
          <Widget title="Open Tickets" value={stats.open_tickets} bg={widgetBg} accent={accent} />
        </div>
      )}
    </Layout>
  );
}

function Widget({ title, value, bg, accent }) {
  return (
    <div className={`p-6 rounded-xl border transition-all hover:-translate-y-1 ${bg}`}>
      <h3 className="text-sm opacity-60 uppercase tracking-wide mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
