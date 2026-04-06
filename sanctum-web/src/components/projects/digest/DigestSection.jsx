import React from 'react';

const ACCENT_COLORS = {
  recommended: 'border-indigo-500',
  inflight: 'border-indigo-500/60',
  backlog: 'border-indigo-500/60',
  completed: 'border-slate-600/40',
};

export default function DigestSection({ title, accent = 'inflight', muted = false, children }) {
  const borderColor = ACCENT_COLORS[accent] || 'border-slate-500';

  return (
    <section className="mb-6">
      <header className="mb-3">
        <h2
          className={`text-sm font-extrabold uppercase tracking-[0.1em] border-l-[3px] ${borderColor} pl-3 ${
            muted ? 'text-slate-500 text-xs opacity-60' : 'text-white'
          }`}
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}
