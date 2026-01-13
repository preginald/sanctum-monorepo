import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto min-w-[300px] p-4 rounded-lg shadow-2xl border flex items-center gap-3 transition-all animate-in slide-in-from-right-full duration-300 ${
              t.type === 'success' ? 'bg-slate-900 border-green-500/50 text-white' :
              t.type === 'error' ? 'bg-slate-900 border-red-500/50 text-white' :
              'bg-slate-900 border-blue-500/50 text-white'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
            {t.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
            {t.type === 'info' && <Info size={20} className="text-blue-500" />}
            
            <span className="text-sm font-medium flex-1">{t.message}</span>
            
            <button 
              onClick={() => removeToast(t.id)} 
              className="opacity-50 hover:opacity-100 transition-opacity p-1"
            >
              <X size={16}/>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
