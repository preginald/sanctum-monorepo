import React, { useState } from 'react';

/**
 * MetadataStrip — Collapsible metadata card for Intelligence Dossier detail pages.
 *
 * Props:
 *   storageKey   {string}   localStorage key for persisting expand/collapse state
 *   collapsed    {JSX}      Content rendered in the collapsed single-line summary
 *   badges       {Array}    [{ label, className, mono }] — rendered as first row when expanded
 *   dates        {Array}    [{ label, value }] — auto 2 or 3-col grid (nulls show '—')
 *   rows         {Array}    [{ label, value, mono, gold }] — additional key-value rows
 *   id           {string}   Entity ID — always rendered last, mono/muted
 *   className    {string}   Optional class on outer wrapper (e.g. 'mb-4')
 */
export default function MetadataStrip({ storageKey, collapsed, badges = [], dates = [], rows = [], id, className = '' }) {
  const [expanded, setExpanded] = useState(() =>
    localStorage.getItem(storageKey) === 'true'
  );

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(storageKey, String(next));
  };

  // Always render all date slots — formatDate handles nulls with '—'
  const dateCols = dates.length >= 3 ? 3 : 2;

  const formatDate = (val) => {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl overflow-hidden ${className}`}>
      {/* TOGGLE BUTTON */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-white/5 transition-colors"
      >
        {expanded ? (
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Metadata</span>
        ) : (
          <span className="flex items-center gap-2 flex-wrap min-w-0">
            {collapsed}
          </span>
        )}
        <span className="opacity-30 text-[10px] shrink-0 ml-2">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* EXPANDED CONTENT */}
      {expanded && (
        <div className="px-4 pb-4 text-xs border-t border-slate-700/50 pt-3 space-y-3">

          {/* BADGES ROW */}
          {badges.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${b.mono ? 'font-mono text-sanctum-gold bg-sanctum-gold/10 border border-sanctum-gold/20 normal-case' : b.className || 'bg-white/10 text-slate-300'}`}
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {/* DATES GRID — auto 2 or 3 col */}
          {dates.length > 0 && (
            <div className={`grid gap-2 ${dateCols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {dates.map((d, i) => (
                <div key={i}>
                  <span className="opacity-50 block mb-0.5">{d.label}</span>
                  <span>{formatDate(d.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* ADDITIONAL ROWS */}
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between items-center">
              <span className="opacity-50">{r.label}</span>
              <span className={`${r.mono ? 'font-mono' : ''} ${r.gold ? 'text-sanctum-gold' : ''}`}>
                {r.value || '—'}
              </span>
            </div>
          ))}

          {/* ID — always last */}
          {id && (
            <div>
              <span className="opacity-50 block mb-0.5">ID</span>
              <span className="font-mono opacity-40 text-[10px] break-all">{id}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
