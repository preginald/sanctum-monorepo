import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, MessageSquare, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import Loading from '../ui/Loading';
import api from '../../lib/api';

export default function TicketDetailModal({ isOpen, onClose, ticketId }) {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticketId || !isOpen) return;
    setLoading(true);
    setError(null);
    api.get(`/tickets/${ticketId}?expand=comments,time_entries`)
      .then(res => setTicket(res.data))
      .catch(() => setError('Failed to load ticket'))
      .finally(() => setLoading(false));
  }, [ticketId, isOpen]);

  const totalHours = ticket?.time_entries?.reduce((sum, te) => {
    if (!te.start_time || !te.end_time) return sum;
    const diff = (new Date(te.end_time) - new Date(te.start_time)) / 3600000;
    return sum + diff;
  }, 0) || ticket?.total_hours || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ticket #${ticketId}`} maxWidth="max-w-3xl">
      {loading && <Loading />}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {ticket && !loading && (
        <div className="space-y-4">
          {/* Header */}
          <h3 className="text-lg font-bold text-white">{ticket.subject}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={ticket.status} map="ticketStatus" />
            <StatusBadge value={ticket.priority} map="priority" />
            <StatusBadge value={ticket.ticket_type} map="ticketType" />
          </div>

          {/* Description */}
          {ticket.description && (
            <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {ticket.description}
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <MessageSquare size={14} />
              {ticket.comments?.length ?? ticket.comment_count ?? 0} comments
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {totalHours.toFixed(1)}h logged
            </span>
          </div>

          {/* Footer link */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => { onClose(); navigate(`/tickets/${ticketId}`); }}
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              Open full page <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
