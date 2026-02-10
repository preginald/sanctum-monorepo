import React from 'react';
import Card from './Card';
import { ArrowRight } from 'lucide-react';

/**
 * StatWidget - Displays a statistic with icon, count, and optional action button
 * 
 * Used for: Active Requests, Open Invoices, Asset Inventory, etc.
 */
export default function StatWidget({
  icon: Icon,
  label,
  count,
  onClick,
  actionButton,
  isNaked = false,
  variant = 'default' // 'default' | 'link'
}) {
  const theme = {
    textMain: isNaked ? 'text-slate-900' : 'text-white'
  };

  const isNumber = typeof count === 'number';
  const isLink = variant === 'link' || typeof count === 'string';

  return (
    <Card 
      onClick={onClick}
      hover={!!onClick}
      className="flex flex-col justify-between group"
      isNaked={isNaked}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
          {Icon && <Icon size={16} />}
          {label}
        </h3>
        {actionButton}
      </div>

      {/* Count or Link */}
      {isNumber ? (
        <div className={`text-6xl font-bold mt-4 ${theme.textMain}`}>
          {count}
        </div>
      ) : (
        <div className="mt-4 flex justify-between items-end">
          <span className="text-xl font-bold opacity-80 group-hover:text-cyan-400 transition-colors">
            {count}
          </span>
          <ArrowRight size={24} className="opacity-50 group-hover:translate-x-1 group-hover:text-cyan-400 transition-all" />
        </div>
      )}
    </Card>
  );
}
