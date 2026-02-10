/**
 * PORTAL COMPONENTS - USAGE EXAMPLES
 * 
 * Copy these patterns when refactoring existing portal pages
 */

import React from 'react';
import { AlertCircle, Receipt, Briefcase } from 'lucide-react';
import { 
  Card, 
  StatWidget, 
  StatusBadge, 
  ProgressBar, 
  ScoreDisplay,
  usePortalTheme 
} from '../components/portal';

function ExamplePortalPage({ account }) {
  const theme = usePortalTheme(account);

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain}`}>
      
      {/* EXAMPLE 1: Basic Card */}
      <Card isNaked={theme.isNaked}>
        <h3>Simple Card</h3>
        <p>Content goes here</p>
      </Card>

      {/* EXAMPLE 2: Clickable Card with Hover */}
      <Card 
        isNaked={theme.isNaked}
        hover={true}
        onClick={() => alert('Clicked!')}
      >
        <p>Hover over me!</p>
      </Card>

      {/* EXAMPLE 3: Dashed Card (Empty State) */}
      <Card 
        isNaked={theme.isNaked}
        dashed={true}
        className="text-center"
      >
        <p className="opacity-50">No data yet</p>
      </Card>

      {/* EXAMPLE 4: Stat Widget (Tickets Count) */}
      <StatWidget
        icon={AlertCircle}
        label="Active Requests"
        count={8}
        onClick={() => navigate('/portal/tickets')}
        isNaked={theme.isNaked}
      />

      {/* EXAMPLE 5: Stat Widget with Action Button */}
      <StatWidget
        icon={Receipt}
        label="Open Invoices"
        count={3}
        actionButton={
          <button className="text-xs text-blue-400">View All →</button>
        }
        isNaked={theme.isNaked}
      />

      {/* EXAMPLE 6: Status Badges */}
      <div className="flex gap-2">
        <StatusBadge status="draft" />
        <StatusBadge status="in_progress" />
        <StatusBadge status="finalized" />
        <StatusBadge status="resolved" size="sm" />
      </div>

      {/* EXAMPLE 7: Progress Bars */}
      <div className="space-y-4">
        {/* Simple progress bar */}
        <ProgressBar score={75} />
        
        {/* With label on top */}
        <ProgressBar score={85} showLabel={true} labelPosition="top" />
        
        {/* Animated */}
        <ProgressBar score={50} animated={true} colorMode="score" />
      </div>

      {/* EXAMPLE 8: Score Display (Big Number + Bar) */}
      <ScoreDisplay score={78} isNaked={theme.isNaked} />

      {/* EXAMPLE 9: Custom Height Progress Bar */}
      <ProgressBar score={92} height="h-4" colorMode="gradient" />
    </div>
  );
}

/**
 * BEFORE (Dashboard widget - 40+ lines):
 * 
 * <div className={`p-6 rounded-xl border ${theme.card} flex flex-col justify-between`}>
 *   <div className="flex justify-between items-start">
 *     <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
 *       <AlertCircle size={16} /> ACTIVE REQUESTS
 *     </h3>
 *     <button className="p-1.5 rounded bg-sanctum-gold/10 hover:bg-sanctum-gold/20">
 *       <Plus size={16} />
 *     </button>
 *   </div>
 *   <div className="text-6xl font-bold mt-4 text-white">8</div>
 * </div>
 */

/**
 * AFTER (Using StatWidget - 7 lines):
 * 
 * <StatWidget
 *   icon={AlertCircle}
 *   label="Active Requests"
 *   count={8}
 *   actionButton={<button className={theme.btn}><Plus size={16} /></button>}
 *   onClick={() => navigate('/tickets')}
 *   isNaked={theme.isNaked}
 * />
 */
