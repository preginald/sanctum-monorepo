import React from 'react';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign } from 'lucide-react';
import clsx from 'clsx'; // Utility for conditional classes

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  
   // 1. DECODE THE SCOPE
   // We safely fallback to 'guest' if user is null for some reason
   const scope = user?.scope || 'guest';

  
  // 2. DEFINE THEME BASED ON BRAND
  // If Naked Tech (nt_only), use Light Mode. Everyone else gets Dark Mode.
  const isNaked = scope === 'nt_only';
  
  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-sanctum-dark',
    text: isNaked ? 'text-slate-900' : 'text-white',
    sidebar: isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    button: isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600',
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
          
          {/* Conditional Bifurcation: Only show Deals to Sanctum/CEO */}
          {!isNaked && (
            <NavItem icon={<DollarSign size={20} />} label="Deals Pipeline" theme={theme} />
          )}

          {/* Conditional Bifurcation: Only show Tickets to Naked/CEO */}
          <NavItem icon={<Wifi size={20} />} label="Service Tickets" theme={theme} />
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button 
            onClick={logout} 
            className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            <LogOut size={18} />
            <span>Disconnect</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Widget title="Revenue (MTD)" value="$42,500" theme={theme} />
          <Widget title="Active Audits" value="3" theme={theme} />
          <Widget title="Open Tickets" value="12" theme={theme} />
        </div>
      </main>
    </div>
  );
}

// Sub-Components for Cleanliness
function NavItem({ icon, label, active, theme }) {
  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all",
      active ? `${theme.button} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100"
    )}>
      {icon}
      <span className="font-medium">{label}</span>
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
