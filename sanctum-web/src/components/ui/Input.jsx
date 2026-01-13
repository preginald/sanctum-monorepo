import React from 'react';

export default function Input({ label, className = "", ...props }) {
  return (
    <div className="w-full">
      {label && <label className="text-xs uppercase opacity-50 block mb-1">{label}</label>}
      <input 
        className={`w-full p-2 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none transition-colors ${className}`}
        {...props} 
      />
    </div>
  );
}
