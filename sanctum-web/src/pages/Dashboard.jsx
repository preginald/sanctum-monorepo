import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign, Loader2 } from 'lucide-react'; // Added Loader2
import clsx from 'clsx';
import axios from 'axios';

// Configure Axios Instance (Should really be in a separate file, but here for speed)
const api = axios.create({
  baseURL: '/api', // Uses the Apache Proxy
});

export default function Dashboard() {
  const { user, token, logout } = useAuthStore();
  const [stats, setStats] = useState({ revenue_mtd: 0, active_audits: 0, open_tickets: 0 });
  const [loading, setLoading] = useState(true);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // THEME CONFIGURATION
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-sanctum-dark',
    text: isNaked ? 'text-slate-900' : 'text-white',
    sidebar: isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    button: isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600',
  };

  // DATA FETCHING
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(response.data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
        // If 401, maybe logout?
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchStats();
  }, [token]);

  // FORMATTER
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);
  };

  return (
    <div className={`flex h-screen w-screen ${theme.bg} ${theme.text}`}>

      {/* SIDEBAR */}
      <aside className={`w-64 flex flex-col ${theme.sidebar} transition-colors duration-300`}>
        <div className="p-6">
          <h1 className={`text-2xl font-bold ${theme.accent}`}>
            {isNaked ? 'Naked Tech' : 'SANCTUM'}
          </h1>
          <p className="text-xs opacity-50 uppercase tracking-widest mt-1">
            {isNaked ? 'Residential Ops' : 'Core System'}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<Shield size={20} />} label="Overview" active theme={theme} />
          <NavItem icon={<Users size={20} />} label="Clients" theme={theme} />
          {!isNaked && <NavItem icon={<DollarSign size={20} />} label="Deals Pipeline" theme={theme} />}
          <NavItem icon={<Wifi size={20} />} label="Service Tickets" theme={theme} />
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button onClick={logout} className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100">
            <LogOut size={18} /> <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">Command Center</h2>
            <p className="opacity-60">Welcome back, Sovereign.</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${theme.button} text-white`}>
            {scope.toUpperCase()} ACCESS
          </div>
        </header>

        {/* WIDGET GRID */}
        {loading ? (
          <div className="flex items-center gap-2 opacity-50"><Loader2 className="animate-spin" /> Loading Intel...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {!isNaked && (
              <Widget title="Revenue (MTD)" value={formatCurrency(stats.revenue_mtd)} theme={theme} />
            )}
            {!isNaked && (
              <Widget title="Active Audits" value={stats.active_audits} theme={theme} />
            )}
            <Widget title="Open Tickets" value={stats.open_tickets} theme={theme} />
          </div>
        )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, theme }) {
  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all",
      active ? `${theme.button} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100"
    )}>
      {icon} <span className="font-medium">{label}</span>
    </div>
  );
}

function Widget({ title, value, theme }) {
  const isNaked = theme.text.includes('slate-900');
  return (
    <div className={clsx(
      "p-6 rounded-xl border transition-all hover:-translate-y-1",
      isNaked ? "bg-white border-slate-200 shadow-sm" : "bg-slate-800 border-slate-700"
    )}>
      <h3 className="text-sm opacity-60 uppercase tracking-wide mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${theme.accent}`}>{value}</p>
    </div>
  );
}
