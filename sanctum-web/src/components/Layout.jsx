import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { 
    LogOut, Shield, Wifi, Users, DollarSign, FileText, Package, 
    Activity, Briefcase, Megaphone, Layers,
    BookOpen, Zap, Clock, PieChart, Menu, X, Terminal, ArrowLeft, RefreshCw, Copy, Check, Receipt
} from 'lucide-react';
import { jwtDecode } from "jwt-decode";
import api from '../lib/api';
import StatusBadge from './ui/StatusBadge';
import GlobalSearch from './ui/GlobalSearch';
import NotificationBell from './ui/NotificationBell';

export default function Layout({ children, title, subtitle, badge, badges, backPath, breadcrumb, actions, onRefresh, onCopyMeta, onViewToggle, viewMode, viewToggleOptions = [] }) {
  const { user, token, setToken, logout } = useAuthStore();
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
   
  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  const drawerColors = isNaked ? 'bg-white border-r border-slate-200' : 'bg-slate-900 border-r border-slate-800';
  const textColors = isNaked ? 'text-slate-900' : 'text-white';
  const bgColors = isNaked ? 'bg-slate-50' : 'bg-sanctum-dark';
  const buttonClass = isNaked ? 'bg-naked-pink hover:bg-pink-600' : 'bg-sanctum-blue hover:bg-blue-600';
  const accentText = isNaked ? 'text-naked-pink' : 'text-sanctum-gold';

  useEffect(() => {
    const handleKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
            e.preventDefault();
            setDrawerOpen(prev => !prev);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const NavItem = ({ icon, label, path }) => {
    const active = path === '/' 
        ? location.pathname === '/' 
        : location.pathname === path || location.pathname.startsWith(path + '/');

    const baseClass = "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all min-h-[48px]";
    const activeClass = active ? `${buttonClass} text-white shadow-lg` : "hover:bg-white/5 opacity-70 hover:opacity-100";
    
    return (
      <div 
        onClick={() => { navigate(path); setDrawerOpen(false); }}
        className={`${baseClass} ${activeClass}`}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
    );
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  return (
    <div className={`flex flex-col h-screen w-screen ${bgColors} ${textColors} overflow-hidden`}>
      <header className={`h-16 flex items-center justify-between px-4 border-b border-white/10 ${isNaked ? 'bg-white' : 'bg-slate-900'} z-30 shrink-0`}>
        <div className="flex items-center gap-2 md:gap-4 w-auto md:w-64">
            <button onClick={() => setDrawerOpen(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Menu size={24} />
            </button>
            <div className="hidden md:block">
                <span className={`font-bold text-lg tracking-wider ${accentText}`}>
                    {isNaked ? 'NAKED' : 'SANCTUM'}
                </span>
            </div>
        </div>
        <div className="flex-1 px-2 md:px-8">
            <GlobalSearch />
        </div>
        <div className="flex items-center gap-2 md:gap-4 w-auto md:w-64 justify-end">
            {(onRefresh || onViewToggle || onCopyMeta) && (
                <div className="flex items-center gap-1 border-r border-white/10 pr-4 mr-0">
                    {onCopyMeta && (<button onClick={() => { const text = onCopyMeta(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-sanctum-gold" title="Copy metadata">{copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}</button>)}
                    {onRefresh && (<button onClick={() => { setIsSpinning(true); onRefresh(); setTimeout(() => setIsSpinning(false), 600); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-sanctum-gold" title="Refresh"><RefreshCw size={16} className={isSpinning ? 'animate-spin' : ''} /></button>)}
                    {viewToggleOptions.length > 0 && onViewToggle && (<div className="hidden xl:flex bg-slate-800 rounded p-1 border border-slate-700 ml-1">{viewToggleOptions.map(opt => (<button key={opt.value} onClick={() => onViewToggle(opt.value)} className={`p-1.5 rounded transition-colors ${viewMode === opt.value ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`} title={opt.value}>{opt.icon}</button>))}</div>)}
                </div>
            )}
            <NotificationBell />
            
            <div className="relative">
                <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors group focus:outline-none" 
                    title="Profile"
                >
                    <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-300 group-hover:border-sanctum-gold group-hover:text-sanctum-gold transition-colors">
                        {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'}
                    </div>
                </button>

                {showProfileMenu && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-100">
                            <div className="px-4 py-2 border-b border-white/5">
                                <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                                <p className="text-sm text-white truncate font-mono">{user?.email || 'admin'}</p>
                            </div>
                            <button 
                                onClick={() => { setShowProfileMenu(false); window.location.href = 'https://core.digitalsanctum.com.au/profile'; }} 
                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                Profile
                            </button>
                            <div className="border-t border-white/5 mt-1 pt-1">
                                <button 
                                    onClick={() => {
                                        localStorage.removeItem('token');
                                        window.location.href = '/login';
                                    }} 
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
            
        </div>
      </header>

      <div className="flex-1 relative flex overflow-hidden">
        {drawerOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={() => setDrawerOpen(false)} />
        )}
        <aside className={`fixed top-0 left-0 h-full w-72 ${drawerColors} z-50 shadow-2xl transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-4 h-16 flex items-center justify-between border-b border-white/10">
                <h2 className="font-bold text-lg px-2">Navigation</h2>
                <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-lg">
                    <X size={20} />
                </button>
            </div>
            <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100%-4rem)] custom-scrollbar">
                <button onClick={() => { navigate('/system/health'); setDrawerOpen(false); }} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-white/5 text-sm opacity-50 hover:opacity-100 hover:text-sanctum-gold mb-4 border border-white/5`}>
                    <Activity size={18} /> <span>System Status</span>
                </button>
                <div className="text-xs font-bold opacity-40 uppercase tracking-widest px-4 py-2 mt-2">Core</div>
                <NavItem icon={<Shield size={20} />} label="Overview" path="/" />
                <NavItem icon={<Users size={20} />} label="Clients" path="/clients" />
                <NavItem icon={<Wifi size={20} />} label="Tickets" path="/tickets" />
                <NavItem icon={<Receipt size={20} />} label="Invoices" path="/invoices" />
                <NavItem icon={<DollarSign size={20} />} label="Receivables" path="/invoices/unpaid" />
                <NavItem icon={<Shield size={20} />} label="Asset Lifecycle" path="/assets/lifecycle" />
                {!isNaked && <NavItem icon={<DollarSign size={20} />} label="Deals" path="/deals" />}
                {!isNaked && <NavItem icon={<Briefcase size={20} />} label="Projects" path="/projects" />}
                {!isNaked && <NavItem icon={<Layers size={20} />} label="Templates" path="/templates" />}
                <div className="text-xs font-bold opacity-40 uppercase tracking-widest px-4 py-2 mt-4">Resources</div>
                <NavItem icon={<Package size={20} />} label="Catalog" path="/catalog" />
                <NavItem icon={<FileText size={20} />} label="Audits" path="/audit" />
                {!isNaked && <NavItem icon={<Megaphone size={20} />} label="Campaigns" path="/campaigns" /> }
                <NavItem icon={<BookOpen size={20} />} label="The Library" path="/wiki" />
                {(user?.role === 'admin' || user?.role === 'tech') && (
                    <>
                        <div className="text-xs font-bold opacity-40 uppercase tracking-widest px-4 py-2 mt-4">Operations</div>
                        <NavItem icon={<Clock size={20} />} label="Timesheets" path="/timesheets" />
                    </>
                )}
                {user?.role === 'admin' && (
                    <>
                        <div className="text-xs font-bold opacity-40 uppercase tracking-widest px-4 py-2 mt-4">Administration</div>
                        <NavItem icon={<Users size={20} className="text-purple-400" />} label="Staff Roster" path="/admin/users" />
                        <NavItem icon={<Zap size={20} className="text-yellow-400" />} label="The Weaver" path="/admin/automations" />
                        <NavItem icon={<Terminal size={20} className="text-sanctum-blue" />} label="The Ingest" path="/admin/ingest" />
                        <NavItem icon={<PieChart size={20} className="text-green-400" />} label="The Oracle" path="/analytics" />
                    </>
                )}
                <div className="h-20"></div>
            </nav>
        </aside>
        <main className="flex-1 overflow-auto relative w-full">
            {showExpiryWarning && (
                <div className="sticky top-0 left-0 w-full bg-red-600 text-white text-center text-xs font-bold py-2 z-20 animate-pulse shadow-lg">
                    ⚠️ SESSION CRITICAL - SAVE WORK IMMEDIATELY
                </div>
            )}
            <div className="p-8 max-w-[1920px] mx-auto">
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 w-full xl:w-auto">
                            {backPath && (
                                <button onClick={() => backPath === -1 ? navigate(-1) : navigate(backPath)} className="p-2 hover:bg-white/10 rounded-lg transition-colors -ml-2">
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <div>
                                {breadcrumb && breadcrumb.length > 0 && (
                                    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-white/50 mb-1">
                                        {breadcrumb.map((crumb, i) => (
                                            <React.Fragment key={i}>
                                                {i > 0 && <span className="opacity-40">›</span>}
                                                {crumb.path
                                                    ? <button onClick={() => navigate(crumb.path)} className="hover:text-white/80 transition-colors">{crumb.label}</button>
                                                    : <span className="text-white/30">{crumb.label}</span>
                                                }
                                            </React.Fragment>
                                        ))}
                                    </nav>
                                )}
                                <h2 className="text-xl md:text-2xl xl:text-3xl font-bold">{title}</h2>
                                {(badges?.length > 0 || badge) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {badges?.map((b, i) => (
                                            <StatusBadge key={i} value={b.value} map={b.map} />
                                        ))}
                                        {badge && !badges?.length && (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${badge.className || 'bg-white/10'}`}>
                                                {badge.label}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {subtitle && <p className="opacity-60 text-sm mt-1">{subtitle}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 flex-wrap">{actions}</div>
                    </div>
                </div>
                {children}
            </div>
        </main>
      </div>
    </div>
  );
}
