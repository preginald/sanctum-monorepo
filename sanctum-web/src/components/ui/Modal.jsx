import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`bg-slate-900 border border-slate-700 p-6 rounded-xl w-full ${maxWidth} relative shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20}/>
        </button>
        
        {title && <h2 className="text-xl font-bold mb-6 text-white">{title}</h2>}
        
        {children}
      </div>
    </div>
  );
}