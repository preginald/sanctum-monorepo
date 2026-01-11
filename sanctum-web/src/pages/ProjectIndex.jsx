import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, Briefcase, Calendar, X, LayoutList, Kanban as KanbanIcon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../lib/api';

const PROJECT_COLS = {
    'planning': { id: 'planning', label: 'Planning', color: 'border-slate-500' },
    'active': { id: 'active', label: 'Active', color: 'border-green-500' },
    'on_hold': { id: 'on_hold', label: 'On Hold', color: 'border-yellow-500' },
    'completed': { id: 'completed', label: 'Completed', color: 'border-blue-500' }
};

export default function ProjectIndex() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [viewMode, setViewMode] = useState('board'); // Default to Board for Projects
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ account_id: '', name: '', budget: '', due_date: '' });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
        const [pRes, cRes] = await Promise.all([
            api.get('/projects'),
            api.get('/accounts')
        ]);
        setProjects(pRes.data);
        setClients(cRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
      e.preventDefault();
      try {
          const payload = {
              account_id: form.account_id,
              name: form.name,
              budget: parseFloat(form.budget) || 0,
              due_date: form.due_date ? form.due_date : null
          };
          const res = await api.post('/projects', payload);
          navigate(`/projects/${res.data.id}`);
      } catch (e) { 
          alert("Failed to create project."); 
      }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const projId = draggableId; // UUID

    // Optimistic
    setProjects(projects.map(p => p.id === projId ? { ...p, status: newStatus } : p));

    // API (Need a specific update endpoint for project status? 
    // We didn't make a PUT /projects/{id} yet? We did in Phase 17.1 design but let's verify if main.py has it.)
    // Wait, main.py has `get_projects` and `create_project`. Did we add `update_project`? 
    // Checking memory... NO. We missed `PUT /projects/{id}`. 
    // We only added Milestone updates.
    // I will add the logic here assuming we will fix Backend in step 3.
    try {
        await api.put(`/projects/${projId}`, { status: newStatus });
    } catch (e) { fetchData(); } 
  };

  // --- RENDERERS ---

  const renderList = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => navigate(`/projects/${p.id}`)}
            className="p-6 bg-slate-900 border border-slate-700 rounded-xl hover:border-sanctum-gold/50 cursor-pointer transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-black/30 rounded-lg">
                <Briefcase className="text-sanctum-gold" size={24} />
              </div>
              <span className={`px-2 py-1 rounded text-xs uppercase font-bold bg-slate-700 text-slate-300`}>
                {p.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-sanctum-gold transition-colors">{p.name}</h3>
            <p className="text-sm text-slate-400 mb-4">{p.account_name}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-2"><Calendar size={12} /> {p.due_date || 'No Deadline'}</span>
              <span>${p.budget.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
  );

  const renderBoard = () => (
      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
        <DragDropContext onDragEnd={onDragEnd}>
          {Object.values(PROJECT_COLS).map((col) => (
            <div key={col.id} className="min-w-[320px] w-1/4 bg-slate-900/30 rounded-xl border border-slate-700/50 flex flex-col">
              <div className={`p-4 border-b-2 ${col.color} bg-black/20 rounded-t-xl sticky top-0`}>
                <h3 className="font-bold text-sm uppercase flex justify-between text-white">
                    {col.label}
                    <span className="opacity-50">{projects.filter(p => p.status === col.id).length}</span>
                </h3>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 p-3 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}>
                    {projects.filter(p => p.status === col.id).map((p, index) => (
                      <Draggable key={p.id} draggableId={p.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className={`p-4 mb-3 rounded-xl bg-slate-800 border border-slate-600 shadow-sm hover:border-sanctum-gold transition-all cursor-pointer group ${snapshot.isDragging ? 'rotate-2 shadow-2xl scale-105' : ''}`}
                          >
                            <h4 className="font-bold text-base mb-1 text-white group-hover:text-sanctum-gold">{p.name}</h4>
                            <div className="text-xs opacity-50 mb-3">{p.account_name}</div>
                            
                            <div className="flex justify-between items-center text-[10px] font-mono opacity-60 pt-3 border-t border-slate-700">
                                <span>{p.due_date || 'TBD'}</span>
                                <span>${p.budget.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </DragDropContext>
      </div>
  );

  return (
    <Layout title="Project Governance">
      <div className="flex justify-between items-center mb-6">
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><LayoutList size={16} /> List</button>
            <button onClick={() => setViewMode('board')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><KanbanIcon size={16} /> Board</button>
        </div>

        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-sanctum-gold text-slate-900 hover:bg-yellow-500 shadow-lg">
          <Plus size={18} /> New Project
        </button>
      </div>

      {viewMode === 'list' ? renderList() : renderBoard()}

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md relative">
                <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 opacity-50 hover:opacity-100"><X size={20}/></button>
                <h2 className="text-xl font-bold mb-4">Initialize Project</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Client</label>
                        <select required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                            <option value="">Select...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs opacity-50 block mb-1">Project Name</label>
                        <input required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Server Migration" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs opacity-50 block mb-1">Budget ($)</label><input required type="number" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
                        <div><label className="text-xs opacity-50 block mb-1">Due Date</label><input type="date" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded">Create Project</button>
                </form>
            </div>
        </div>
      )}
    </Layout>
  );
}