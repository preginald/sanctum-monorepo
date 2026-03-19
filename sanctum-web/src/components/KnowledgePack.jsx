import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { FileText, Link2, Code, Key, File, ChevronDown, ChevronRight, FolderOpen, Flag, Loader2, Package } from 'lucide-react';

const typeIcon = (type) => {
  const map = { file: File, url: Link2, code_path: Code, document: FileText, credential_ref: Key };
  const Icon = map[type] || FileText;
  return <Icon size={14} className="opacity-40 shrink-0" />;
};

const statusColor = (s) => {
  const map = {
    draft: 'bg-slate-500/20 text-slate-400',
    review: 'bg-amber-500/20 text-amber-400',
    approved: 'bg-green-500/20 text-green-400',
    superseded: 'bg-blue-500/10 text-blue-300',
    archived: 'bg-red-500/10 text-red-300',
  };
  return map[s] || '';
};

export default function KnowledgePack({ accountId }) {
  const navigate = useNavigate();
  const [artefacts, setArtefacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (accountId) fetchArtefacts();
  }, [accountId]);

  const fetchArtefacts = async () => {
    try {
      const res = await api.get(`/artefacts?account_id=${accountId}`);
      setArtefacts(res.data);
    } catch (e) {
      console.error('Failed to load knowledge pack', e);
    } finally { setLoading(false); }
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 flex items-center gap-2 mb-3">
        <Package size={14} /> Knowledge Pack
      </h3>
      <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin" /></div>
    </div>
  );

  if (artefacts.length === 0) return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 flex items-center gap-2 mb-3">
        <Package size={14} /> Knowledge Pack
      </h3>
      <p className="text-xs opacity-40">No artefacts for this account.</p>
    </div>
  );

  // Group artefacts by project → milestone
  // Each artefact has links array with entity_type and entity_id
  const projectMap = {}; // projectId -> { name, milestones: { msId -> { name, artefacts } } }
  const unlinked = [];

  artefacts.forEach(a => {
    const projectLinks = (a.links || []).filter(l => l.linked_entity_type === 'project');
    const milestoneLinks = (a.links || []).filter(l => l.linked_entity_type === 'milestone');

    if (projectLinks.length === 0 && milestoneLinks.length === 0) {
      unlinked.push(a);
      return;
    }

    projectLinks.forEach(pl => {
      if (!projectMap[pl.linked_entity_id]) {
        projectMap[pl.linked_entity_id] = { milestones: {}, artefacts: [] };
      }
      projectMap[pl.linked_entity_id].artefacts.push(a);
    });

    milestoneLinks.forEach(ml => {
      // Find if this artefact also has a project link
      const parentProject = projectLinks[0]?.linked_entity_id || '_unlinked_project';
      if (!projectMap[parentProject]) {
        projectMap[parentProject] = { milestones: {}, artefacts: [] };
      }
      if (!projectMap[parentProject].milestones[ml.linked_entity_id]) {
        projectMap[parentProject].milestones[ml.linked_entity_id] = [];
      }
      projectMap[parentProject].milestones[ml.linked_entity_id].push(a);
    });
  });

  const ArtefactRow = ({ artefact }) => (
    <button
      onClick={() => navigate(`/artefacts/${artefact.id}`)}
      className="w-full flex items-center gap-2 p-2 bg-black/20 rounded hover:bg-white/5 transition-colors text-left"
    >
      {typeIcon(artefact.artefact_type)}
      <span className="flex-1 text-xs text-sanctum-gold hover:underline truncate">{artefact.name}</span>
      {artefact.status && (
        <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${statusColor(artefact.status)}`}>
          {artefact.status}
        </span>
      )}
      {artefact.category && (
        <span className="text-[9px] opacity-40 uppercase">{artefact.category}</span>
      )}
    </button>
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 flex items-center gap-2 mb-4">
        <Package size={14} /> Knowledge Pack
      </h3>

      <div className="space-y-3">
        {Object.entries(projectMap).map(([projectId, data]) => {
          const projKey = `proj_${projectId}`;
          const isExpanded = expanded[projKey] !== false; // default expanded
          const hasMilestones = Object.keys(data.milestones).length > 0;
          const totalArtefacts = data.artefacts.length + Object.values(data.milestones).reduce((sum, ms) => sum + ms.length, 0);

          return (
            <div key={projectId} className="border border-slate-700/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggle(projKey)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <FolderOpen size={14} className="text-sanctum-gold opacity-60" />
                <span className="flex-1 text-xs font-bold truncate">
                  {projectId === '_unlinked_project' ? 'No Project' : projectId.substring(0, 8) + '...'}
                </span>
                <span className="text-[10px] opacity-40">{totalArtefacts} artefact{totalArtefacts !== 1 ? 's' : ''}</span>
              </button>

              {isExpanded && (
                <div className="px-3 py-2 space-y-2">
                  {/* Direct project artefacts */}
                  {data.artefacts.map(a => (
                    <ArtefactRow key={a.id} artefact={a} />
                  ))}

                  {/* Milestone groups */}
                  {Object.entries(data.milestones).map(([msId, msArtefacts]) => {
                    const msKey = `ms_${msId}`;
                    const msExpanded = expanded[msKey] !== false;
                    return (
                      <div key={msId} className="ml-3">
                        <button
                          onClick={() => toggle(msKey)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 bg-black/20 rounded hover:bg-black/30 transition-colors text-left"
                        >
                          {msExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                          <Flag size={12} className="opacity-40" />
                          <span className="flex-1 text-[11px] font-bold truncate opacity-70">{msId.substring(0, 8)}...</span>
                          <span className="text-[10px] opacity-40">{msArtefacts.length}</span>
                        </button>
                        {msExpanded && (
                          <div className="ml-4 mt-1 space-y-1">
                            {msArtefacts.map(a => (
                              <ArtefactRow key={`${msId}-${a.id}`} artefact={a} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Unlinked artefacts */}
        {unlinked.length > 0 && (
          <div className="border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle('unlinked')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
            >
              {expanded.unlinked !== false ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <FileText size={14} className="opacity-40" />
              <span className="flex-1 text-xs font-bold opacity-50">Unlinked</span>
              <span className="text-[10px] opacity-40">{unlinked.length}</span>
            </button>
            {expanded.unlinked !== false && (
              <div className="px-3 py-2 space-y-1">
                {unlinked.map(a => (
                  <ArtefactRow key={a.id} artefact={a} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
