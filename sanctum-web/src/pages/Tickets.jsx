import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Plus, LayoutList, Kanban as KanbanIcon, Filter, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../lib/api';

// IMPORTS FROM REFACTOR
import { TicketTypeIcon, StatusBadge, PriorityBadge } from '../components/tickets/TicketBadges';
import TicketCreateModal from '../components/tickets/TicketCreateModal';

const COLUMNS = {
  'new': { id: 'new', label: 'New / Triage', color: 'border-blue-500' },
  'open': { id: 'open', label: 'In Progress', color: 'border-yellow-500' },
  'pending': { id: 'pending', label: 'Pending Vendor', color: 'border-purple-500' },
  'resolved': { id: 'resolved', label: 'Resolved', color: 'border-green-500' }
};

export default function Tickets() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  
  // DATA STATE
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI STATE
  const [viewMode, setViewMode] = useState('list');
  const [showModal, setShowModal] = useState(false);
  
  // FILTERS
  const [statusFilter, setStatusFilter] = useState('active'); // 'all', 'active', 'resolved'
  const [priorityFilter, setPriorityFilter] = useState('all');

  const isAdmin = user?.role !== 'client';
  const isNaked = user?.scope === 'nt_only';
  
  const theme = {
    btn: isNaked ? "bg-naked-pink hover:bg-pink-600" : "bg-sanctum-blue hover:bg-blue-600",
    header: isNaked ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-sanctum-gold"
  };

  useEffect(() => { fetchData(); }, [token]);

  const fetchData = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const ticketId = parseInt(draggableId);

    // Optimistic Update
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));

    try {
        await api.put(`/tickets/${ticketId}`, { status: newStatus });
    } catch (e) { fetchData(); } // Revert on error
  };

  // --- FILTER LOGIC ---
  const filteredTickets = tickets.filter(t => {
      // 1. Status Filter
      if (statusFilter === 'active' && t.status === 'resolved') return false;
      if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
      
      // 2. Priority Filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      
      return true;
  });

  const renderListView = () => (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <table className="w-full text-left">
        <thead className={`text-xs uppercase ${theme.header}`}>
          <tr>
            <th className="p-4 w-12"></th>
            <th className="p-4 w-24">ID</th>
            <th className="p-4">Client</th>
            <th className="p-4 w-1/3">Subject</th>
            <th className="p-4">Priority</th>
            <th className="p-4">Status</th>
          </tr>
        </thead>
        <tbody className="text-sm text-white divide-y divide-slate-800">
          {filteredTickets.map(t => (
            <tr 
              key={t.id} 
              onClick={() => navigate(`/tickets/${t.id}`)} 
              className="hover:bg-white/5 cursor-pointer transition-colors group"
            >
              <td className="p-4"><TicketTypeIcon type={t.ticket_type} /></td>
              <td className="p-4 font-mono opacity-50">#{t.id}</td>
              <td className="p-4 font-bold hover:text-sanctum-gold">{t.account_name}</td>
              <td className="p-4">
                  <div className="flex items-center gap-2">
                      <span className="font-medium">{t.subject}</span>
                      {t.milestone_name && (
                          <span className="whitespace-nowrap px-1.5 py-0.5 rounded bg-blue-900/50 text-[10px] text-blue-300 border border-blue-800">
                              {t.milestone_name}
                          </span>
                      )}
                  </div>
              </td>
              <td className="p-4"><PriorityBadge priority={t.priority} /></td>
              <td className="p-4"><StatusBadge status={t.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredTickets.length === 0 && <div className="p-8 text-center opacity-30">No tickets match filters.</div>}
    </div>
  );

  const renderBoardView = () => (
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
        <DragDropContext onDragEnd={onDragEnd}>
          {Object.values(COLUMNS).map((col) => {
             const itemsInCol = filteredTickets.filter(t => t.status === col.id);
             
             return (
                <div key={col.id} className="min-w-[300px] w-1/4 bg-slate-900/50 rounded-xl border border-slate-700 flex flex-col">
                <div className={`p-4 border-b-2 ${col.color} bg-black/20 rounded-t-xl sticky top-0`}>
                    <h3 className="font-bold text-sm uppercase flex justify-between">
                        {col.label}
                        <span className="opacity-50">{itemsInCol.length}</span>
                    </h3>
                </div>
                <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-3 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                        {itemsInCol.map((t, index) => (
                        <Draggable key={t.id} draggableId={String(t.id)} index={index}>
                            {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => navigate(`/tickets/${t.id}`)}
                                className={`p-4 mb-3 rounded bg-slate-800 border border-slate-600 shadow-sm hover:border-sanctum-gold transition-colors cursor-pointer group ${snapshot.isDragging ? 'rotate-2 shadow-xl' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <TicketTypeIcon type={t.ticket_type} />
                                    <PriorityBadge priority={t.priority} />
                                </div>
                                <h4 className="font-bold text-sm mb-1 text-white group-hover:text-blue-300">{t.subject}</h4>
                                <div className="text-xs opacity-50 mb-2">{t.account_name}</div>
                                {t.milestone_name && (
                                    <div className="mt-2 pt-2 border-t border-slate-700">
                                        <span className="text-[10px] text-sanctum-gold">{t.milestone_name}</span>
                                    </div>
                                )}
                            </div>
                            )}
                        </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                    )}
                </Droppable>
                </div>
             );
          })}
        </DragDropContext>
      </div>
  );

  return (
    <Layout title="Service Desk">
      
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        
        <div className="flex items-center gap-4">
            {/* VIEW TOGGLE */}
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><LayoutList size={16} /> List</button>
                <button onClick={() => setViewMode('board')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><KanbanIcon size={16} /> Board</button>
            </div>

            {/* FILTERS - UPDATED WITH DARK BG */}
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <div className="px-2 text-slate-500"><Filter size={14}/></div>
                <select 
                    className="bg-slate-900 text-sm text-white outline-none border-r border-slate-700 pr-2 cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="active">Active (Default)</option>
                    <option value="all">All Status</option>
                    <option value="resolved">Resolved</option>
                </select>
                <select 
                    className="bg-slate-900 text-sm text-white outline-none pl-2 cursor-pointer"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                </select>
            </div>
        </div>

        {isAdmin && (
            <button onClick={() => setShowModal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white shadow-lg ${theme.btn}`}>
            <Plus size={18} /> New Ticket
            </button>
        )}
      </div>

      {viewMode === 'list' ? renderListView() : renderBoardView()}

      <TicketCreateModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={fetchData} />
    </Layout>
  );
}