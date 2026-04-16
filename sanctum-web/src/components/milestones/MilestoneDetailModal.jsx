import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Calendar } from 'lucide-react';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import Loading from '../ui/Loading';
import api from '../../lib/api';

export default function MilestoneDetailModal({ isOpen, onClose, milestoneId }) {
  const navigate = useNavigate();
  const [milestone, setMilestone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!milestoneId || !isOpen) return;
    setLoading(true);
    setError(null);
    api.get(`/milestones/${milestoneId}`)
      .then(res => setMilestone(res.data))
      .catch(() => setError('Failed to load milestone'))
      .finally(() => setLoading(false));
  }, [milestoneId, isOpen]);

  const tickets = milestone?.tickets || [];
  const resolved = tickets.filter(t => t.status === 'resolved').length;
  const total = tickets.length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Milestone" maxWidth="max-w-2xl">
      {loading && <Loading />}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {milestone && !loading && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{milestone.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={milestone.status} map="milestoneStatus" />
            {milestone.due_date && (
              <span className="text-sm text-slate-400 flex items-center gap-1">
                <Calendar size={14} /> {milestone.due_date}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{resolved}/{total} tickets resolved</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Ticket list */}
          {total > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {tickets.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                  <span className="text-slate-500 font-mono text-xs">#{t.id}</span>
                  <span className="text-slate-300 truncate flex-1">{t.subject}</span>
                  <StatusBadge value={t.status} map="ticketStatus" />
                </div>
              ))}
            </div>
          )}

          {/* Footer link */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => { onClose(); navigate(`/milestones/${milestoneId}`); }}
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
