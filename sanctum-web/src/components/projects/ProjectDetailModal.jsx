import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';
import Loading from '../ui/Loading';
import api from '../../lib/api';

export default function ProjectDetailModal({ isOpen, onClose, projectId }) {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId || !isOpen) return;
    setLoading(true);
    setError(null);
    api.get(`/projects/${projectId}`)
      .then(res => setProject(res.data))
      .catch(() => setError('Failed to load project'))
      .finally(() => setLoading(false));
  }, [projectId, isOpen]);

  const milestones = project?.milestones || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Project" maxWidth="max-w-3xl">
      {loading && <Loading />}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {project && !loading && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{project.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge value={project.status} map="projectStatus" />
            {project.account_name && (
              <span className="text-sm text-slate-400">{project.account_name}</span>
            )}
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {project.description}
            </p>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase text-slate-500 font-bold tracking-wide">
                Milestones ({milestones.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {milestones.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-slate-800/50">
                    <span className="text-slate-300 truncate flex-1">{m.name}</span>
                    <StatusBadge value={m.status} map="ticketStatus" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer link */}
          <div className="pt-3 border-t border-slate-700">
            <button
              onClick={() => { onClose(); navigate(`/projects/${projectId}`); }}
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
