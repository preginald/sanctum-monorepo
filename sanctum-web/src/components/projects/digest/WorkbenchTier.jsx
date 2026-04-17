import React from 'react';
import { Wrench } from 'lucide-react';
import WorkbenchCard from '../WorkbenchCard';

export default function WorkbenchTier({ pins, maxPins, onUnpin, onNavigate, onOpenTicket, onOpenMilestone, onOpenProject, notifications = [], onMarkNotificationRead }) {
  return (
    <section className="border-l-4 border-sanctum-gold/50 bg-slate-800/30 p-4 rounded-r-lg">
      <div className="flex items-center gap-2 mb-3">
        <Wrench size={16} className="text-sanctum-gold" />
        <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-sanctum-gold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Workbench
        </h3>
        <span className="text-[10px] text-slate-500 ml-1">{pins.length}/{maxPins}</span>
      </div>
      {pins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pins.map(pin => {
            const cardNotifications = notifications.filter(n => String(n.project_id) === String(pin.project_id));
            return (
              <WorkbenchCard
                key={pin.project_id}
                pin={pin}
                onUnpin={onUnpin}
                onNavigate={onNavigate}
                onOpenTicket={onOpenTicket}
                onOpenMilestone={onOpenMilestone}
                onOpenProject={onOpenProject}
                notifications={cardNotifications}
                onDismiss={onMarkNotificationRead}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 py-2">Pin projects you're working on</p>
      )}
    </section>
  );
}
