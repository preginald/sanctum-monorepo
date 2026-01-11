import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  loading = false, 
  disabled = false,
  className = "",
  type = "button"
}) {
  
  const baseStyle = "font-bold rounded transition-all flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-sanctum-blue hover:bg-blue-600 text-white shadow-lg",
    success: "bg-green-600 hover:bg-green-500 text-white shadow-lg",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-lg",
    gold: "bg-sanctum-gold hover:bg-yellow-500 text-slate-900 shadow-lg",
    secondary: "bg-white/10 hover:bg-white/20 text-white",
    ghost: "text-slate-400 hover:text-white hover:bg-white/5",
    icon: "p-2 hover:bg-white/10 opacity-70 hover:opacity-100 rounded-full" // Circular icon button
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2"
  };

  const style = `${baseStyle} ${variants[variant]} ${variant === 'icon' ? sizes.icon : sizes[size]} ${className}`;

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled || loading} 
      className={`${style} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading && <Loader2 className="animate-spin" size={16} />}
      {!loading && Icon && <Icon size={16} />}
      {!loading && children}
    </button>
  );
}