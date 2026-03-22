import React from 'react';

const PRICING_MODEL_LABELS = {
  fixed_price: 'Fixed Price',
  time_and_materials: 'Time & Materials',
};

export default function ProjectStats({ project }) {
  const totalBilled = project.milestones?.reduce((sum, m) => m.invoice_id ? sum + parseFloat(m.billable_amount || 0) : sum, 0) || 0;
  const percentUsed = project.budget > 0 ? Math.min(100, (totalBilled / parseFloat(project.budget)) * 100) : 0;

  const marketValue = parseFloat(project.market_value || 0);
  const quotedPrice = parseFloat(project.quoted_price || 0);
  const discountAmount = parseFloat(project.discount_amount || 0);
  const hasPricing = marketValue > 0 || quotedPrice > 0;

  return (
      <div className="space-y-4">
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
