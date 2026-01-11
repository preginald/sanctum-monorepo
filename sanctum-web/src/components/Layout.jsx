import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign, FileText, Package, Activity, ChevronLeft, RefreshCw, Briefcase } from 'lucide-react';
import clsx from 'clsx';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api'; 

export default function Layout({ children, title }) {
  // CRITICAL FIX: Ensure setToken is destructured here
  const { user, token, setToken, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false); // NEW STATE
  
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  const theme = {
    bg: isNaked ? 'bg-slate-50' : 'bg-sanctum-dark',
    text: isNaked ? 'text-slate-900' : 'text-white',
    // Dynamic width based on collapsed state
    sidebar: clsx(
        isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800',
        "flex flex-col transition-all duration-300",
        collapsed ? "w-20" : "w-64"
    ),
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
          active ? `${theme.button} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100",
          collapsed ? "justify-center" : ""
        )}
        title={collapsed ? label : ""}
      >
        {icon} 
        {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
      </div>
    );
  };

  return (
    <div className={`flex h-screen w-screen ${theme.bg} ${theme.text}`}>
      <aside className={theme.sidebar}>
        <div className="p-6 flex justify-between items-start">
          {!collapsed && (
              <div>
                <h1 className={`text-2xl font-bold ${theme.accent}`}>
                    {isNaked ? 'Naked' : 'SANCTUM'}
                </h1>
                <p className="text-xs opacity-50 uppercase tracking-widest mt-1">
                    {isNaked ? 'Ops' : 'Core'}
                </p>
              </div>
          )}
          {/* TOGGLE BUTTON */}
          <button onClick={() => setCollapsed(!collapsed)} className="opacity-50 hover:opacity-100 mt-1">
              {collapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
          <NavItem icon={<Shield size={20} />} label="Overview" path="/" />
          <NavItem icon={<Users size={20} />} label="Clients" path="/clients" />
          {!isNaked && <NavItem icon={<DollarSign size={20} />} label="Deals" path="/deals" />}
          {!isNaked && <NavItem icon={<Briefcase size={20} />} label="Projects" path="/projects" />}
          <NavItem icon={<Wifi size={20} />} label="Tickets" path="/tickets" />
          <NavItem icon={<Package size={20} />} label="Catalog" path="/catalog" />
          <NavItem icon={<FileText size={20} />} label="Audits" path="/audit" />
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <button onClick={() => navigate('/admin/health')} className={clsx("flex items-center gap-3 text-sm opacity-50 hover:opacity-100 hover:text-sanctum-gold w-full px-2", collapsed ? "justify-center" : "text-left")}>
            <Activity size={18} /> {!collapsed && <span>System Health</span>}
          </button>
          <button onClick={logout} className={clsx("flex items-center gap-3 text-sm opacity-70 hover:opacity-100 w-full px-2", collapsed ? "justify-center" : "text-left")}>
            <LogOut size={18} /> {!collapsed && <span>Disconnect</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto relative">
        {/* ... [Keep Header and Children] ... */}
        {children}
      </main>
    </div>
  );
}