import React from 'react';
import { Calendar } from 'lucide-react';

export default function ProjectStats({ project }) {
  const totalBilled = project.milestones?.reduce((sum, m) => m.invoice_id ? sum + m.billable_amount : sum, 0) || 0;
  const percentUsed = project.budget > 0 ? Math.min(100, (totalBilled / project.budget) * 100) : 0;

  return (
      <div className="space-y-6">
          {/* BURNDOWN */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Budget Burn Down</h3>
              <div className="mb-2 flex justify-between text-sm">
                  <span className="text-green-400">${totalBilled.toLocaleString()} Billed</span>
                  <span className="opacity-50">of ${project.budget.toLocaleString()}</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-sanctum-gold" style={{ width: `${percentUsed}%` }}></div>
              </div>
          </div>
          {/* TIMELINE */}
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Timeline</h3>
              <div className="flex items-center gap-3 text-sm mb-2">
                  <Calendar size={16} className="text-sanctum-gold"/> 
                  <span>Due: {project.due_date || "TBD"}</span>
              </div>
          </div>
      </div>
  );
}