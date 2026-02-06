import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Briefcase, Calendar, CheckCircle, Clock, Circle, Loader2 } from 'lucide-react';

export default function PortalProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/portal/projects/${id}`);
      setProject(res.data);
    } catch (e) {
      console.error("Failed to load project", e);
      if (e.response?.status === 403 || e.response?.status === 404) {
          navigate('/portal');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : 'TBD';

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  if (!project) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div>
            <button 
                onClick={() => navigate('/portal')}
                className="flex items-center text-slate-400 hover:text-white transition-colors mb-6 text-sm"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </button>
            
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <Briefcase className="text-sanctum-gold" />
                        {project.name}
                    </h1>
                    <p className="text-slate-400 max-w-2xl leading-relaxed">{project.description}</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-white/10 text-white`}>
                        {project.status}
                    </span>
                </div>
            </div>
        </div>

        {/* PROGRESS CARD */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-xl">
            <div className="flex justify-between items-end mb-4">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Overall Progress</h3>
                    <div className="text-4xl font-bold text-white">{project.progress}%</div>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                    <div>Start: {formatDate(project.start_date)}</div>
                    <div>Due: {formatDate(project.due_date)}</div>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-black/40 h-4 rounded-full overflow-hidden border border-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-sanctum-gold to-yellow-600 transition-all duration-1000 ease-out" 
                    style={{ width: `${project.progress}%` }}
                ></div>
            </div>
        </div>

        {/* MILESTONES TIMELINE */}
        <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 pl-2">Project Roadmap</h3>
            
            <div className="relative border-l-2 border-slate-800 ml-4 space-y-8 pb-4">
                {project.milestones?.map((milestone, index) => {
                    const isCompleted = milestone.status === 'completed';
                    const isActive = milestone.status === 'active' || milestone.status === 'in_progress';
                    
                    return (
                        <div key={milestone.id} className="relative pl-8 group">
                            {/* Dot */}
                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 transition-colors ${
                                isCompleted ? 'bg-green-500 border-green-500' : 
                                isActive ? 'bg-slate-900 border-sanctum-gold animate-pulse' : 
                                'bg-slate-900 border-slate-600'
                            }`}>
                                {isCompleted && <CheckCircle size={12} className="text-slate-900 absolute top-0 left-0" />}
                            </div>

                            {/* Card */}
                            <div className={`p-5 rounded-lg border transition-all ${
                                isActive ? 'bg-slate-800 border-sanctum-gold/50 shadow-lg' : 
                                isCompleted ? 'bg-slate-800/50 border-green-500/20 opacity-70' : 
                                'bg-slate-800/30 border-slate-800'
                            }`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className={`font-bold text-lg ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>
                                        {milestone.name}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                        isCompleted ? 'bg-green-500/10 text-green-500' :
                                        isActive ? 'bg-yellow-500/10 text-yellow-500' :
                                        'bg-slate-700 text-slate-500'
                                    }`}>
                                        {milestone.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                    <Calendar size={12} />
                                    Due: {formatDate(milestone.due_date)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {project.milestones?.length === 0 && (
                    <div className="pl-8 text-slate-500 italic text-sm">No milestones defined.</div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}