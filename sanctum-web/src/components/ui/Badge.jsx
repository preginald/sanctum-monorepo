import React from 'react';

export default function Badge({ children, variant = 'default', className = "" }) {
  const variants = {
    default: "bg-slate-700 text-slate-400",
    success: "bg-green-500/20 text-green-500",
    warning: "bg-yellow-500/20 text-yellow-500",
    danger: "bg-red-500/20 text-red-500",
    info: "bg-blue-500/20 text-blue-500",
    gold: "bg-yellow-600/20 text-sanctum-gold border border-sanctum-gold/20",
    outline: "border border-slate-600 text-slate-400"
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}