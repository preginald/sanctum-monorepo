import React from 'react';
import { Bug, Zap, Clipboard, LifeBuoy } from 'lucide-react';

export const TicketTypeIcon = ({ type }) => {
  switch(type) {
      case 'bug': return <Bug size={16} className="text-red-400" />;
      case 'feature': return <Zap size={16} className="text-yellow-400" />;
      case 'task': return <Clipboard size={16} className="text-blue-400" />;
      default: return <LifeBuoy size={16} className="text-slate-400" />;
  }
};

export const PriorityBadge = ({ priority }) => {
  const colors = {
    critical: 'bg-red-500/20 text-red-500',
    high: 'bg-orange-500/20 text-orange-500',
    normal: 'bg-blue-500/20 text-blue-500',
    low: 'bg-slate-700 text-slate-400'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const colors = {
    resolved: 'bg-green-500/20 text-green-500',
    open: 'bg-yellow-500/20 text-yellow-500',
    pending: 'bg-purple-500/20 text-purple-500',
    new: 'bg-blue-500/20 text-blue-500'
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[status] || colors.new}`}>
      {status}
    </span>
  );
};