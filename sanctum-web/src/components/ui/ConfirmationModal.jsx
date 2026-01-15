import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDangerous = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <div className="p-6 text-center">
          <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${isDangerous ? 'bg-red-500/20 text-red-500' : 'bg-sanctum-gold/20 text-sanctum-gold'}`}>
            <AlertTriangle size={24} />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          
          <div className="flex gap-3 justify-center">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className={`px-4 py-2 rounded text-white text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5 ${isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}