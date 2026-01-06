import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, TrendingUp, AlertCircle, CheckCircle, Wallet } from 'lucide-react';
import api from '../lib/api';

export default function Dashboard() {
  const { user, token } = useAuthStore();
  
  // UPDATED STATE INITIALIZATION (Matches Backend v1.2.1)
  const [stats, setStats] = useState({ 
    revenue_realized: 0, 
    pipeline_value: 0,
    active_audits: 0, 
    open_tickets: 0,
    critical_tickets: 0
  });
  
  const [loading, setLoading] = useState(true);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // DUAL BRAND STYLING
  const accent = isNaked ? 'text-naked-pink' : 'text-sanctum-gold';
  // Naked Tech gets a clean white look, Sanctum gets the "Dark Mode" command center
  const widgetBg = isNaked 
    ? "bg-white border-slate-200 shadow-sm text-slate-800" 
    : "bg-slate-800 border-slate-700 text-slate-100";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats');
        setStats(response.data);
      } catch (error) { 
        console.error("Dashboard Sync Failed:", error); 
      } finally { 
        setLoading(false); 
      }
    };
    if (token) fetchStats();
  }, [token]);

  const formatCurrency = (val) => 
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val || 0);

  return (
    <Layout title="Command Center">
      {loading ? (
        <div className="flex items-center gap-2 opacity-50 p-6">
          <Loader2 className="animate-spin" /> Establish Link...
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TOP ROW: KEY METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. REVENUE (Sanctum Only) */}
            {!isNaked && (
              <Widget 
                title="Revenue (Realized)" 
                value={formatCurrency(stats.revenue_realized)} 
                icon={<Wallet className="w-5 h-5 opacity-50" />}
                bg={widgetBg} 
                accent={accent} 
              />
            )}

            {/* 2. PIPELINE (Sanctum Only) */}
            {!isNaked && (
              <Widget 
                title="Pipeline Value" 
                value={formatCurrency(stats.pipeline_value)} 
                icon={<TrendingUp className="w-5 h-5 opacity-50" />}
                bg={widgetBg} 
                accent="text-blue-400" // Distinct color for potential money
              />
            )}

            {/* 3. AUDITS (Sanctum Only) */}
            {!isNaked && (
              <Widget 
                title="Active Audits" 
                value={stats.active_audits} 
                icon={<CheckCircle className="w-5 h-5 opacity-50" />}
                bg={widgetBg} 
                accent={accent} 
              />
            )}

            {/* 4. TICKETS (Shared / Naked Tech) */}
            <Widget 
              title="Open Tickets" 
              value={stats.open_tickets} 
              icon={<AlertCircle className="w-5 h-5 opacity-50" />}
              bg={widgetBg} 
              accent={isNaked ? 'text-naked-pink' : 'text-emerald-400'} 
            />
            
            {/* 5. CRITICAL TICKETS (Shared) - Highlight if > 0 */}
            {stats.critical_tickets > 0 && (
               <Widget 
               title="CRITICAL INCIDENTS" 
               value={stats.critical_tickets} 
               icon={<AlertCircle className="w-5 h-5" />}
               bg="bg-red-900/20 border-red-500/50 border" // Panic Mode Styling
               accent="text-red-500 animate-pulse" 
             />
            )}

          </div>

          {/* LOWER SECTION: Placeholder for future Activity Feed */}
          {!loading && (
             <div className={`p-6 rounded-xl border ${widgetBg} min-h-[200px]`}>
                <h3 className="text-sm opacity-60 uppercase tracking-wide mb-4">Recent Intel</h3>
                <div className="text-sm opacity-40 italic">
                  No recent activity intercepted...
                </div>
             </div>
          )}
        </div>
      )}
    </Layout>
  );
}

// Reusable Widget Component
function Widget({ title, value, bg, accent, icon }) {
  return (
    <div className={`p-6 rounded-xl border transition-all hover:-translate-y-1 flex flex-col justify-between ${bg}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xs font-bold opacity-60 uppercase tracking-widest">{title}</h3>
        {icon}
      </div>
      <p className={`text-3xl font-mono font-bold ${accent}`}>{value}</p>
    </div>
  );
}