import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { 
    LogOut, Shield, Wifi, Users, DollarSign, FileText, Package, 
    Activity, ChevronLeft, ChevronRight, Briefcase, Megaphone, 
    BookOpen, Zap, Clock, User, PieChart
} from 'lucide-react';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api'; 
import GlobalSearch from './ui/GlobalSearch';
import NotificationBell from './ui/NotificationBell';


export default function Layout({ children, title }) {
  const { user, token, setToken, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => {
      return localStorage.getItem('sanctum_sidebar') === 'true';
  });

  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // HELPER: Dynamic Classes
  const sidebarWidth = collapsed ? "w-20" : "w-64";
  const sidebarColors = isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800';
  const textColors = isNaked ? 'text-slate-900' : 'text-white';
  const bgColors = isNaked ? 'bg-slate-50' : 'bg-sanctum-dark';
  const buttonClass = isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600';
  const accentText = isNaked ? 'text-naked-pink' : 'text-sanctum-gold';

  // SESSION KEEPER
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

  const toggleSidebar = () => {
      const newState = !collapsed;
      setCollapsed(newState);
      localStorage.setItem('sanctum_sidebar', newState);
  };

  // NAV ITEM COMPONENT
  const NavItem = ({ icon, label, path }) => {
    // Check for exact match or sub-route match (except for root "/")
    const active = path === '/' 
        ? location.pathname === '/' 
        : location.pathname === path || location.pathname.startsWith(path + '/');

    const baseClass = "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all min-h-[48px]";
    const activeClass = active ? `${buttonClass} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100";
    const collapseClass = collapsed ? "justify-center" : "";
    
    return (
      <div 
        onClick={() => navigate(path)}
        className={`${baseClass} ${activeClass} ${collapseClass}`}
        title={collapsed ? label : ""}
      >
        {/* ICON ALWAYS RENDERS */}
        <span className="flex-shrink-0">{icon}</span>
        
        {/* TEXT ONLY RENDERS IF NOT COLLAPSED */}
        {!collapsed && <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>}
      </div>
    );
  };

  return (
    <div className={`flex h-screen w-screen ${bgColors} ${textColors}`}>
      {/* SIDEBAR */}
      <aside className={`${sidebarColors} flex flex-col transition-all duration-300 ${sidebarWidth} overflow-hidden`}>
        <div className="p-6 flex justify-between items-start h-20">
          {!collapsed && (
              <div className="animate-in fade-in duration-300">
                <h1 className={`text-2xl font-bold ${accentText}`}>
                    {isNaked ? 'Naked' : 'SANCTUM'}
                </h1>
                <p className="text-xs opacity-50 uppercase tracking-widest mt-1">
                    {isNaked ? 'Ops' : 'Core'}
                </p>
              </div>
          )}
          <button onClick={toggleSidebar} className={`opacity-50 hover:opacity-100 mt-1 transition-transform ${collapsed ? 'mx-auto' : ''}`}>
              {collapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* CORE MODULES */}
          <NavItem icon={<Shield size={20} />} label="Overview" path="/" />
          <NavItem icon={<Users size={20} />} label="Clients" path="/clients" />
          {!isNaked && <NavItem icon={<DollarSign size={20} />} label="Deals" path="/deals" />}
          {!isNaked && <NavItem icon={<Briefcase size={20} />} label="Projects" path="/projects" />}
          <NavItem icon={<Wifi size={20} />} label="Tickets" path="/tickets" />
          
          <div className="my-4 border-t border-white/10 mx-2"></div>
          
          {/* RESOURCES */}
          <NavItem icon={<Package size={20} />} label="Catalog" path="/catalog" />
          <NavItem icon={<FileText size={20} />} label="Audits" path="/audit" />
          {!isNaked && <NavItem icon={<Megaphone size={20} />} label="Campaigns" path="/campaigns" />}
          <NavItem icon={<BookOpen size={20} />} label="The Library" path="/wiki" />

          {/* ADMIN ONLY SECTION */}
          {user?.role === 'admin' && (
            <>
                <div className="my-4 border-t border-white/10 mx-2"></div>
                <NavItem icon={<Users size={20} className="text-purple-400" />} label="Staff Roster" path="/admin/users" />
                <NavItem icon={<Zap size={20} className="text-yellow-400" />} label="The Weaver" path="/admin/automations" />
                
                {/* NEW: THE ORACLE */}
                <NavItem icon={<PieChart size={20} className="text-green-400" />} label="The Oracle" path="/analytics" />
            </>
          )}

          {/* SHARED STAFF TOOLS (Admin + Tech) */}
          {(user?.role === 'admin' || user?.role === 'tech') && (
             <NavItem icon={<Clock size={20} />} label="Timesheets" path="/timesheets" />
          )}

          {/* GLOBAL USER TOOLS */}
          <div className="my-4 border-t border-white/10 mx-2"></div>
          <NavItem icon={<User size={20} />} label="My Profile" path="/profile" />

        </nav>


        <div className="p-4 border-t border-slate-800/50 space-y-2">
          <button onClick={() => navigate('/system/health')} className={`flex items-center gap-3 text-sm opacity-50 hover:opacity-100 hover:text-sanctum-gold w-full px-2 py-2 rounded hover:bg-white/5 ${collapsed ? "justify-center" : "text-left"}`} title="System Health">
            <Activity size={18} /> {!collapsed && <span>System Health</span>}
          </button>
          <button onClick={logout} className={`flex items-center gap-3 text-sm opacity-70 hover:opacity-100 w-full px-2 py-2 rounded hover:bg-white/5 ${collapsed ? "justify-center" : "text-left"}`} title="Disconnect">
            <LogOut size={18} /> {!collapsed && <span>Disconnect</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-auto relative">
        {showExpiryWarning && (
          <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center text-xs font-bold py-2 z-50 animate-pulse shadow-lg">
            ⚠️ SESSION CRITICAL - SAVE WORK IMMEDIATELY
          </div>
        )}

        {/* UPDATED HEADER */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold">{title}</h2>
            <p className="opacity-60">Sovereign Architecture</p>
          </div>
          
          {/* SEARCH BAR (Center-Right) */}
          <div className="flex-1 px-4 md:px-12 flex justify-end items-center gap-4">
              <GlobalSearch />
              <div className="border-l border-white/10 h-6 mx-2"></div>
              <NotificationBell />
          </div>

          <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${buttonClass} text-white ml-4`}>
            {scope.toUpperCase()} ACCESS
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
}