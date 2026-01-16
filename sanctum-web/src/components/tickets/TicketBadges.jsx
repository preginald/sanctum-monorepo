import React from 'react';
import { 
    Bug, Zap, Clipboard, Lock, PenTool, Siren, 
    LifeBuoy, Flame, HelpCircle, Hammer
} from 'lucide-react';

export const StatusBadge = ({ status }) => {
    const colors = {
        new: "bg-blue-500 text-white",
        open: "bg-green-500 text-white",
        pending: "bg-yellow-500 text-slate-900",
        resolved: "bg-slate-700 text-slate-400"
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${colors[status] || "bg-slate-500"}`}>
            {status}
        </span>
    );
};

export const PriorityBadge = ({ priority }) => {
    const colors = {
        low: "text-slate-400 bg-slate-800 border-slate-700",
        normal: "text-blue-400 bg-blue-900/20 border-blue-800",
        high: "text-orange-400 bg-orange-900/20 border-orange-800",
        critical: "text-red-400 bg-red-900/20 border-red-800 animate-pulse"
    };
    return (
        <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold tracking-wider ${colors[priority] || colors.normal}`}>
            {priority}
        </span>
    );
};

export const TicketTypeIcon = ({ type }) => {
    // Normalize type just in case
    const t = (type || 'support').toLowerCase();

    switch (t) {
        case 'bug': return <Bug size={16} className="text-red-400" />;
        case 'hotfix': return <Flame size={16} className="text-orange-500 fill-orange-500/20" />;
        case 'feature': return <Zap size={16} className="text-yellow-400" />;
        case 'refactor': return <Hammer size={16} className="text-pink-400" />; // NEW
        case 'task': return <Clipboard size={16} className="text-blue-400" />;
        case 'access': return <Lock size={16} className="text-purple-400" />;
        case 'maintenance': return <PenTool size={16} className="text-slate-400" />;
        case 'alert': return <Siren size={16} className="text-red-500" />;
        case 'support': return <LifeBuoy size={16} className="text-cyan-400" />;
        default: return <HelpCircle size={16} className="text-slate-500" />;
    }
};