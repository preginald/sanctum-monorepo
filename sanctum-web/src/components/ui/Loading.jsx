import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading({ message = "Loading Data..." }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 w-full text-slate-500 animate-pulse">
      <Loader2 size={32} className="animate-spin mb-4 text-sanctum-gold" />
      <p className="text-sm font-bold uppercase tracking-widest">{message}</p>
    </div>
  );
}