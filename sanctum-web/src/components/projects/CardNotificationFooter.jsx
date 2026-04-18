import { MessageSquare, XCircle, CheckCircle, ArrowUpRight, AlertTriangle, UserPlus } from 'lucide-react';

const ICON_MAP = {
  agent_stop: CheckCircle,
  agent_error: XCircle,
  ticket_comment: MessageSquare,
  ticket_status_change: ArrowUpRight,
  ticket_assigned: UserPlus,
  health_degraded: AlertTriangle,
};

const ERROR_TYPES = new Set(['agent_error']);

function getPrimaryNotification(notifications) {
  if (!notifications || notifications.length === 0) return null;
  const errors = notifications.filter(n => ERROR_TYPES.has(n.event_type));
  if (errors.length > 0) {
    return errors.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }
  return [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export default function CardNotificationFooter({ notifications = [], onDismissAll }) {
  const primary = getPrimaryNotification(notifications);
  if (!primary) return null;

  const isError = ERROR_TYPES.has(primary.event_type);
  const Icon = ICON_MAP[primary.event_type] || MessageSquare;

  const handleClick = (e) => {
    e.stopPropagation();
    onDismissAll?.(notifications.map(n => n.id));
  };

  return (
    <div
      onClick={handleClick}
      className={`
        flex items-center gap-2 px-2.5 py-2 mt-2 rounded-md cursor-pointer
        transition-colors duration-150 group/notif
        ${isError
          ? 'bg-red-500/[0.08] hover:bg-red-500/[0.14]'
          : 'bg-slate-400/[0.06] hover:bg-slate-400/[0.12]'
        }
      `}
    >
      <Icon
        size={14}
        className={`flex-shrink-0 ${isError ? 'text-red-400' : 'text-blue-400'}`}
      />
      <span
        className={`
          text-[11px] truncate flex-1 min-w-0
          ${isError ? 'text-red-400' : 'text-slate-400'}
        `}
      >
        {primary.title || primary.message}
      </span>
      <span className="text-[10px] text-slate-600 flex-shrink-0 opacity-0 group-hover/notif:opacity-100 transition-opacity duration-150">
        dismiss
      </span>
    </div>
  );
}
