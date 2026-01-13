import React, { forwardRef } from 'react';

const Input = forwardRef(({ label, className = "", error, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="text-xs uppercase opacity-50 block mb-1">{label}</label>}
      <input 
        ref={ref}
        className={`w-full p-2 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-gold outline-none transition-colors ${error ? 'border-red-500' : ''} ${className}`}
        {...props} 
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
