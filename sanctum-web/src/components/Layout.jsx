import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, Shield, Wifi, Users, DollarSign, FileText, Package, Activity, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api'; 

export default function Layout({ children, title }) {
  const { user, token, setToken, logout } = useAuthStore();

  // FIX: PERSIST STATE
  const [collapsed, setCollapsed] = useState(() => {
      return localStorage.getItem('sanctum_sidebar') === 'true';
  });

  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // HELPER: Dynamic Classes without 'clsx'
  const sidebarWidth = collapsed ? "w-20" : "w-64";
  const sidebarColors = isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800';
  const textColors = isNaked ? 'text-slate-900' : 'text-white';
  const bgColors = isNaked ? 'bg-slate-50' : 'bg-sanctum-dark';
  const buttonClass = isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600';
  const accentText = isNaked ? 'text-naked-pink' : 'text-sanctum-gold';

  // SESSION KEEPER LOGIC
  useEffect(() => {
    if (!token) return;
    const checkSession = async () => {
      try {
        const decoded = jwtDecode(token);
        const now = Date.now() / 1000; 
        const timeLeft = decoded.exp - now;
        
        if (timeLeft < 300 && timeLeft > 30) {
            try {
                const res = await api.post('/refresh');
                setToken(res.data.access_token); 
                setShowExpiryWarning(false);
            } catch(e) { console.error("Refresh failed", e); }
        } else if (timeLeft < 30 && timeLeft > 0) {
            setShowExpiryWarning(true);
        } else {
            setShowExpiryWarning(false);
        }
      } catch (e) { }
    };
    const interval = setInterval(checkSession, 60000); 
    checkSession(); 
    return () => clearInterval(interval);
  }, [token, setToken]);

  // FIX: SAVE ON TOGGLE
  const toggleSidebar = () => {
      const newState = !collapsed;
      setCollapsed(newState);
      localStorage.setItem('sanctum_sidebar', newState);
  };

  const NavItem = ({ icon, label, path }) => {
    const active = location.pathname === path;
    // Dynamic Class Construction
    const baseClass = "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all";
    const activeClass = active ? `${buttonClass} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100";
    const collapseClass = collapsed ? "justify-center" : "";
    
    return (
      <div 
        onClick={() => navigate(path)}
        className={`${baseClass} ${activeClass} ${collapseClass}`}
        title={collapsed ? label : ""}
      >
        {icon} 
        {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
      </div>
    );
  };

  return (
    <div className={`flex h-screen w-screen ${bgColors} ${textColors}`}>
      <aside className={`${sidebarColors} flex flex-col transition-all duration-300 ${sidebarWidth}`}>
        <div className="p-6 flex justify-between items-start">
          {!collapsed && (
              <div>
                <h1 className={`text-2xl font-bold ${accentText}`}>
                    {isNaked ? 'Naked' : 'SANCTUM'}
                </h1>
                <p className="text-xs opacity-50 uppercase tracking-widest mt-1">
                    {isNaked ? 'Ops' : 'Core'}
                </p>
              </div>
          )}
          {/* UPDATE TOGGLE HANDLER */}
          <button onClick={toggleSidebar} className="opacity-50 hover:opacity-100 mt-1">
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
          <button onClick={() => navigate('/admin/health')} className={`flex items-center gap-3 text-sm opacity-50 hover:opacity-100 hover:text-sanctum-gold w-full px-2 ${collapsed ? "justify-center" : "text-left"}`}>
            <Activity size={18} /> {!collapsed && <span>System Health</span>}
          </button>
          <button onClick={logout} className={`flex items-center gap-3 text-sm opacity-70 hover:opacity-100 w-full px-2 ${collapsed ? "justify-center" : "text-left"}`}>
            <LogOut size={18} /> {!collapsed && <span>Disconnect</span>}
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
          <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${buttonClass} text-white`}>
            {scope.toUpperCase()} ACCESS
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
}