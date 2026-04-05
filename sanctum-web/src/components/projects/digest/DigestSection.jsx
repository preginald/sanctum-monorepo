import React from 'react';

const ACCENT_COLORS = {
  inflight: 'border-green-500',
  backlog: 'border-purple-500',
  completed: 'border-blue-500',
};

export default function DigestSection({ title, accent = 'inflight', count, children }) {
  const borderColor = ACCENT_COLORS[accent] || 'border-slate-500';

  return (
    <section className="mb-8">
      <div className={`border-l-4 ${borderColor} pl-3 mb-4`}>
        <h2 className="text-lg font-semibold text-white">
          {title}
          {count != null && <span className="ml-2 text-sm text-slate-500 font-normal">({count})</span>}
        </h2>
      </div>
      {children}
    </section>
  );
}
