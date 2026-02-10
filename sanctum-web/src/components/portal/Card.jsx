import React from 'react';

/**
 * Card - Base card wrapper component
 * 
 * Used across portal for consistent card styling
 * Handles theme (Sanctum vs Naked Tech) automatically
 */
export default function Card({ 
  children, 
  className = '', 
  onClick,
  hover = false,
  dashed = false,
  padding = 'p-6',
  isNaked = false // Pass from parent (account.brand_affinity === 'nt')
}) {
  const theme = {
    card: isNaked 
      ? 'bg-white border-slate-200 shadow-sm' 
      : 'bg-slate-800 border-slate-700'
  };

  const borderStyle = dashed ? 'border-2 border-dashed' : 'border';
  const hoverEffect = hover ? 'hover:border-cyan-500/50 transition-colors cursor-pointer' : '';
  const clickable = onClick ? 'cursor-pointer' : '';

  return (
    <div 
      onClick={onClick}
      className={`rounded-xl ${borderStyle} ${theme.card} ${padding} ${hoverEffect} ${clickable} ${className}`}
    >
      {children}
    </div>
  );
}
