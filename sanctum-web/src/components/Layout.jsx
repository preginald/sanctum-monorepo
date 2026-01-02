import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign, FileText } from 'lucide-react';
import clsx from 'clsx';

export default function Layout({ children, title }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-sanctum-dark',
    text: isNaked ? 'text-slate-900' : 'text-white',
    sidebar: isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800',
    accent: isNaked ? 'text-naked-pink' : 'text-sanctum-gold',
    button: isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600',
  };

  const NavItem = ({ icon, label, path }) => {
    const active = location.pathname === path;
    return (
      <div 
        onClick={() => navigate(path)}
        className={clsx(
          "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all",
          active ? `${theme.button} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100"
        )}
      >
        {icon} <span className="font-medium">{label}</span>
      </div>
    );
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
          <NavItem icon={<Shield size={20} />} label="Overview" path="/" />
          <NavItem icon={<Users size={20} />} label="Clients" path="/clients" />
          {!isNaked && <NavItem icon={<DollarSign size={20} />} label="Deals Pipeline" path="/deals" />}
          <NavItem icon={<Wifi size={20} />} label="Service Tickets" path="/tickets" />
          <NavItem icon={<FileText size={20} />} label="Audit Engine" path="/audit" />
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
            <h2 className="text-3xl font-bold">{title}</h2>
            <p className="opacity-60">Sovereign Architecture</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${theme.button} text-white`}>
            {scope.toUpperCase()} ACCESS
          </div>
        </header>
        
        {/* INJECT PAGE CONTENT HERE */}
        {children}
      </main>
    </div>
  );
}
