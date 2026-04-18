import React, { useEffect, useState } from 'react';
import { PinOff, Maximize2, Diamond, GripVertical } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import HealthDot from './HealthDot';
import TicketBadge from './TicketBadge';
import CardNotificationFooter from './CardNotificationFooter';
import api from '../../lib/api';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

export default function WorkbenchCard({ pin, onUnpin, onNavigate, onOpenTicket, onOpenMilestone, onOpenProject, notifications = [], onDismissAll, dragHandleProps, isDragging = false }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = () => {
      api.get(`/workbench/${pin.project_id}/summary`).then(res => {
        if (!cancelled) setSummary(res.data);
      }).catch(() => {});
    };
    fetchSummary();
    const id = setInterval(fetchSummary, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pin.project_id]);

  const progress = summary?.progress;
  const pct = progress && progress.total > 0
    ? Math.round((progress.resolved / progress.total) * 100)
    : 0;

  return (
    <div
      onClick={() => onNavigate(pin.project_id)}
      data-dragging={isDragging ? 'true' : undefined}
      className={`bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3.5 cursor-pointer transition-all hover:border-slate-600 relative group flex flex-col ${isDragging ? 'opacity-60 ring-2 ring-amber-400/60 shadow-lg scale-[0.98]' : ''}`}
    >
      {/* Header: drag handle + project name + hover actions */}
      <div className="flex items-start justify-between gap-2">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="flex-shrink-0 flex items-center justify-center -ml-1 mr-1 mt-0.5 rounded cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
        <h4 className="font-bold text-slate-50 text-sm line-clamp-2 flex-1" title={pin.project_name}>{pin.project_name}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => { e.stopPropagation(); onUnpin(pin.project_id); }}
            className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
            title="Unpin"
          >
            <PinOff size={14} className="stroke-slate-500 hover:stroke-slate-200" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); (onOpenProject || onNavigate)(pin.project_id); }}
            className="w-[26px] h-[26px] flex items-center justify-center rounded-md hover:bg-slate-700 transition-colors"
            title="Open project"
          >
            <Maximize2 size={14} className="stroke-slate-500 hover:stroke-slate-200" />
          </button>
        </div>
      </div>

      {/* Meta: status + account + health */}
      <div className="flex items-center gap-2 mt-1">
        <StatusBadge value={pin.project_status} map="projectStatus" />
        <span className="text-[10px] text-slate-500 truncate">{pin.account_name}</span>
        {summary?.health && (
          <HealthDot colour={summary.health.colour} tooltip={summary.health.tooltip} />
        )}
      </div>

      {/* Milestone */}
      {summary?.active_milestone && (
        <div
          className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenMilestone) onOpenMilestone(summary.active_milestone.id);
          }}
        >
          <Diamond size={10} className="text-slate-500 flex-shrink-0" />
          <span className="truncate">{summary.active_milestone.name}</span>
        </div>
      )}

      {/* Ticket rows */}
      {summary?.current_ticket && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] uppercase text-slate-500 font-medium w-7 flex-shrink-0">Now</span>
          <TicketBadge
            ticketId={summary.current_ticket.id}
            variant="current"
            status={summary.current_ticket.status}
            onOpenModal={onOpenTicket}
          />
          <span className="text-[11px] text-slate-300 truncate">{summary.current_ticket.subject}</span>
        </div>
      )}
      {summary?.next_ticket && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] uppercase text-slate-500 font-medium w-7 flex-shrink-0">Next</span>
          <TicketBadge
            ticketId={summary.next_ticket.id}
            variant="next"
            status={summary.next_ticket.status !== 'new' ? summary.next_ticket.status : undefined}
            onOpenModal={onOpenTicket}
          />
          <span className="text-[11px] text-slate-500 truncate">{summary.next_ticket.subject}</span>
        </div>
      )}

      {/* Footer: progress bar + count + timestamp */}
      {progress && progress.total > 0 && (
        <div className="flex items-center gap-2 mt-auto pt-3">
          <div className="flex-1 bg-slate-700 h-[3px] rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {progress.resolved}/{progress.total}
          </span>
          {summary.last_activity_at && (
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              {formatTimeAgo(summary.last_activity_at)}
            </span>
          )}
        </div>
      )}

      {/* In-card notification footer */}
      <CardNotificationFooter notifications={notifications} onDismissAll={onDismissAll} />
    </div>
  );
}
