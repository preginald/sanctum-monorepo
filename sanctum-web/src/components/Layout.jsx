import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign, FileText, Package, Activity, RefreshCw, Briefcase } from 'lucide-react';
import clsx from 'clsx';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api'; 

export default function Layout({ children, title }) {
  // CRITICAL FIX: Ensure setToken is destructured here
  const { user, token, setToken, logout } = useAuthStore();
  
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
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

  // SESSION KEEPER LOGIC
  useEffect(() => {
    if (!token) return;

    const checkSession = async () => {
      try {
        const decoded = jwtDecode(token);
        const now = Date.now() / 1000; // seconds
        const timeLeft = decoded.exp - now;
        
        // 1. If < 5 mins left AND > 30 seconds: Attempt Silent Refresh
        if (timeLeft < 300 && timeLeft > 30) {
            console.log("Session refreshing...");
            try {
                const res = await api.post('/refresh');
                // This call was crashing because setToken wasn't defined
                setToken(res.data.access_token); 
                setShowExpiryWarning(false);
                console.log("Session extended.");
            } catch(e) {
                console.error("Refresh failed", e);
            }
        } 
        // 2. If < 30 seconds: Show Panic Warning
        else if (timeLeft < 30 && timeLeft > 0) {
            setShowExpiryWarning(true);
        } else {
            setShowExpiryWarning(false);
        }
      } catch (e) { }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    checkSession(); // Check on mount

    return () => clearInterval(interval);
  }, [token, setToken]);

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

          {!isNaked && <NavItem icon={<Briefcase size={20} />} label="Projects" path="/projects" />}
          <NavItem icon={<Wifi size={20} />} label="Service Tickets" path="/tickets" />
          <NavItem icon={<Package size={20} />} label="Catalog" path="/catalog" />
          <NavItem icon={<FileText size={20} />} label="Audit Engine" path="/audit" />
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <button onClick={() => navigate('/admin/health')} className="flex items-center gap-3 text-sm opacity-50 hover:opacity-100 hover:text-sanctum-gold w-full text-left px-2">
            <Activity size={18} /> <span>System Health</span>
          </button>
          <button onClick={logout} className="flex items-center gap-3 text-sm opacity-70 hover:opacity-100 w-full text-left px-2">
            <LogOut size={18} /> <span>Disconnect</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto relative">
        {showExpiryWarning && (
          <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center text-xs font-bold py-2 z-50 animate-pulse shadow-lg">
            ⚠️ SESSION CRITICAL - SAVE WORK IMMEDIATELY
          </div>
        )}

        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">{title}</h2>
            <p className="opacity-60">Sovereign Architecture</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${theme.button} text-white`}>
            {scope.toUpperCase()} ACCESS
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
}