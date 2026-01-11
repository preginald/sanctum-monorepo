import React from 'react';

export default function Card({ children, className = "", title, action }) {
  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl p-6 ${className}`}>
      {(title || action) && (
        <div className="flex justify-between items-center mb-4">
          {title && (
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 flex items-center gap-2">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}