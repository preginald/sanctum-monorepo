import React from 'react';
import { Check } from 'lucide-react';

const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    ref={ref}
    onClick={(e) => {
      e.stopPropagation();
      onCheckedChange(!checked);
    }}
    className={`peer h-4 w-4 shrink-0 rounded border border-slate-600 ring-offset-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-sanctum-gold data-[state=checked]:text-slate-900 data-[state=checked]:border-sanctum-gold flex items-center justify-center ${className || ""}`}
    data-state={checked ? 'checked' : 'unchecked'}
    {...props}
  >
    {checked && <Check className="h-3 w-3 stroke-[3]" />}
  </button>
));

Checkbox.displayName = "Checkbox";

export default Checkbox;
