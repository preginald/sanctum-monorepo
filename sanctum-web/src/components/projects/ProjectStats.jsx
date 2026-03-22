import React from 'react';

const PRICING_MODEL_LABELS = {
  fixed_price: 'Fixed Price',
  time_and_materials: 'Time & Materials',
  gift: 'Gift',
};

const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ProjectStats({ project }) {
  const totalBilled = project.milestones?.reduce((sum, m) => m.invoice_id ? sum + parseFloat(m.billable_amount || 0) : sum, 0) || 0;
  const percentUsed = project.budget > 0 ? Math.min(100, (totalBilled / parseFloat(project.budget)) * 100) : 0;

  const marketValue = parseFloat(project.market_value || 0);
  const quotedPrice = parseFloat(project.quoted_price || 0);
  const discountAmount = parseFloat(project.discount_amount || 0);
  const hasPricing = marketValue > 0 || quotedPrice > 0;

  const allTickets = project.milestones?.flatMap(m => m.tickets || []) || [];
  const totalHours = allTickets.reduce((s, t) => s + (t.total_hours || 0), 0);
  const totalInternalCost = allTickets.reduce((s, t) => s + parseFloat(t.total_cost || 0), 0);
  const totalUnpriced = allTickets.reduce((s, t) => s + (t.unpriced_entries || 0), 0);
  const hasDeliveryCost = totalHours > 0;

  const isGift = project.pricing_model === 'gift';
  const isFixed = project.pricing_model === 'fixed_price';
  const overBudget = isFixed && quotedPrice > 0 && totalInternalCost > quotedPrice;

  return (
      <div className="space-y-4">
          {hasDeliveryCost && (
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Delivery Cost</h3>
                  <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-baseline">
                          <span className="opacity-50">Total Hours</span>
                          <span className="font-mono font-bold text-white text-lg">{totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                          <span className="opacity-50">Internal Cost</span>
                          <span className="font-mono font-bold text-white text-lg">${fmt(totalInternalCost)}</span>
                      </div>
                      {isGift && (
                          <div className="text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/10 rounded px-2 py-1.5 text-center">
                              Gifted — internal cost: ${fmt(totalInternalCost)}
                          </div>
                      )}
                      {isFixed && quotedPrice > 0 && (
                          <div className={`text-xs ${overBudget ? 'text-red-400/80 bg-red-400/5 border-red-400/10' : 'text-green-400/80 bg-green-400/5 border-green-400/10'} border rounded px-2 py-1.5 text-center`}>
                              Quoted: ${fmt(quotedPrice)} · Internal: ${fmt(totalInternalCost)} · {overBudget ? 'Over budget' : 'Under budget'}
                          </div>
                      )}
                      {totalUnpriced > 0 && (
                          <div className="text-[10px] text-orange-400/60">
                              {totalUnpriced} {totalUnpriced === 1 ? 'entry' : 'entries'} unpriced
                          </div>
                      )}
                  </div>
              </div>
          )}

          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Budget Burn Down</h3>
              <div className="mb-2 flex justify-between text-sm">
                  <span className="text-green-400">${totalBilled.toLocaleString()} Billed</span>
                  <span className="opacity-50">of ${parseFloat(project.budget || 0).toLocaleString()}</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-sanctum-gold" style={{ width: `${percentUsed}%` }}></div>
              </div>
          </div>

          {hasPricing && (
              <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Project Financials</h3>
                  <div className="space-y-3 text-sm">
                      {project.pricing_model && (
                          <div className="flex justify-between">
                              <span className="opacity-50">Pricing Model</span>
                              <span>{PRICING_MODEL_LABELS[project.pricing_model] || project.pricing_model}</span>
                          </div>
                      )}
                      {marketValue > 0 && (
                          <div className="flex justify-between">
                              <span className="opacity-50">Market Value</span>
                              <span>${marketValue.toLocaleString()}</span>
                          </div>
                      )}
                      <div className="flex justify-between">
                          <span className="opacity-50">Quoted Price</span>
                          <span className="text-green-400">${quotedPrice.toLocaleString()}</span>
                      </div>
                      {discountAmount > 0 && (
                          <div className="flex justify-between">
                              <span className="opacity-50">Discount</span>
                              <span className="text-amber-400">
                                  ${discountAmount.toLocaleString()}
                                  {project.discount_reason && <span className="opacity-50 ml-2">({project.discount_reason})</span>}
                              </span>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
  );
}
