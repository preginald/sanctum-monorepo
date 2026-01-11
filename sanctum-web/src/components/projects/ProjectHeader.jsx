import React from 'react';
import { ArrowLeft, Plus, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProjectHeader({ project, onAddMilestone }) {
  const navigate = useNavigate();
  if (!project) return null;

  return (
    <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/projects')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
                <button onClick={() => navigate(`/clients/${project.account_id}`)} className="opacity-50 text-sm flex items-center gap-2 hover:text-white hover:underline">
                    <Briefcase size={12}/> {project.account_name}
                </button>
                <span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded uppercase text-slate-300">{project.status}</span>
            </div>
          </div>
        </div>
        <button onClick={onAddMilestone} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold">
            <Plus size={16}/> Add Milestone
        </button>
      </div>
  );
}