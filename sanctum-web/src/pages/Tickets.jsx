import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'; from '../components/Layout';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';
import useModalStore from '../store/modalStore';

// UI KIT
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import KanbanBoard from '../components/ui/KanbanBoard';
import Loading from '../components/ui/Loading';
import Card from '../components/ui/Card';

// ICONS
import { Plus, LayoutList, Kanban as KanbanIcon, Filter } from 'lucide-react';

// COMPONENTS
import { TicketTypeIcon, StatusBadge, PriorityBadge } from '../components/tickets/TicketBadges';

const COLUMNS = {
  'new': { id: 'new', label: 'New / Triage', color: 'border-blue-500' },
  'open': { id: 'open', label: 'In Progress', color: 'border-yellow-500' },
  'pending': { id: 'pending', label: 'Pending Vendor', color: 'border-purple-500' },
  'resolved': { id: 'resolved', label: 'Resolved', color: 'border-green-500' }
};

export default function Tickets({ autoCreate = false }) { 
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { addToast } = useToast();
  const { openModal } = useModalStore();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  
  // Filters & Sort
  const [statusFilter, setStatusFilter] = useState('active');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  const isAdmin = user?.role !== 'client';

  useEffect(() => { fetchData(); }, [token]);

  // DATA FETCHING
  const fetchData = async () => {
    // Note: We don't set loading(true) here to avoid flashing if just refreshing list
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (e) { 
      console.error(e);
      addToast("Failed to load tickets", "error");
    } 
    finally { setLoading(false); }
  };

  // HANDLE MODAL OPEN
  const handleOpenModal = () => {
      // FIX: Pass fetchData as the onSuccess callback
      openModal('TICKET_CREATE', { onSuccess: fetchData });
  };

  // Handle Auto-Open from Router
  useEffect(() => {
    if (autoCreate) {
        handleOpenModal();
    }
  }, [autoCreate]); // Depend on autoCreate only to prevent loops

  const handleSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
  };

  // Filter Logic
  const filteredTickets = tickets.filter(t => {
      if (statusFilter === 'active' && t.status === 'resolved') return false;
      if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
  });

  // Sort Logic
  const sortedTickets = React.useMemo(() => {
      let items = [...filteredTickets];
      if (sortConfig.key) {
        items.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if(sortConfig.key === 'status') {
                const ranks = { new: 0, open: 1, pending: 2, resolved: 3 };
                aVal = ranks[aVal]; bVal = ranks[bVal];
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
      }
      return items;
  }, [filteredTickets, sortConfig]);

  const onDragEnd = async (result) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === result.source.droppableId && destination.index === result.source.index) return;
    
    const newStatus = destination.droppableId;
    const ticketId = parseInt(draggableId);
    
    // Optimistic Update
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    try { 
      await api.put(`/tickets/${ticketId}`, { status: newStatus }); 
    } catch (e) { 
      fetchData(); 
      addToast("Failed to update ticket status", "error");
    }
  };

  if (loading) {
      return (
          <Layout title="Service Desk">
              <Loading message="Synchronizing Tickets..." />
          </Layout>
      );
  }

  return (
    <Layout
      title="Service Desk"
      subtitle="Ticket management and operations"
      actions={isAdmin ? (
        <Button variant="primary" icon={Plus} onClick={handleOpenModal}>New Ticket</Button>
      ) : null}
    >
      {/* VIEW TOGGLE + FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><LayoutList size={16} /> List</button>
                <button onClick={() => setViewMode('board')} className={`p-2 rounded flex items-center gap-2 text-sm font-bold ${viewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'}`}><KanbanIcon size={16} /> Board</button>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                <div className="px-2 text-slate-500"><Filter size={14}/></div>
                <select className="bg-slate-900 text-sm text-white outline-none border-r border-slate-700 pr-2 cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="active">Active (Default)</option>
                    <option value="all">All Status</option>
                    <option value="resolved">Resolved</option>
                </select>
                <select className="bg-slate-900 text-sm text-white outline-none pl-2 cursor-pointer" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                </select>
            </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <Card className="overflow-hidden p-0">
          <Table className="w-full text-left">
            <TableHeader className="text-xs uppercase bg-black/20 text-slate-400 font-bold tracking-wider">
              <TableRow>
                <TableHead className="p-4 w-12"></TableHead>
                <TableHead className="p-4 w-24 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>ID</TableHead>
                <TableHead className="p-4">Client</TableHead>
                <TableHead className="p-4 w-1/3">Subject</TableHead>
                <TableHead className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('priority')}>Priority</TableHead>
                <TableHead className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('status')}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm text-white divide-y divide-slate-800">
              {sortedTickets.map(t => (
                <TableRow key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="hover:bg-white/5 cursor-pointer transition-colors group">
                  <TableCell className="p-4"><TicketTypeIcon type={t.ticket_type} /></TableCell>
                  <TableCell className="p-4 font-mono opacity-50">#{t.id}</TableCell>
                  <TableCell className="p-4 font-bold hover:text-sanctum-gold">{t.account_name}</TableCell>
                  <TableCell className="p-4"><div className="flex items-center gap-2"><span className="font-medium">{t.subject}</span>{t.milestone_name && <Badge variant="info">{t.milestone_name}</Badge>}</div></TableCell>
                  <TableCell className="p-4"><PriorityBadge priority={t.priority} /></TableCell>
                  <TableCell className="p-4"><StatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sortedTickets.length === 0 && <div className="p-8 text-center opacity-30">No tickets match filters.</div>}
        </Card>
      ) : (
          <KanbanBoard 
            columns={COLUMNS} 
            items={sortedTickets} 
            onDragEnd={onDragEnd}
            renderCard={(t) => (
                <div 
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="p-4 rounded-xl bg-slate-800 border border-slate-600 shadow-sm hover:border-sanctum-gold transition-all cursor-pointer group"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <TicketTypeIcon type={t.ticket_type} />
                            <span className="font-mono text-xs opacity-50">#{t.id}</span>
                        </div>
                        <PriorityBadge priority={t.priority} />
                    </div>
                    <h4 className="font-bold text-sm mb-1 text-white group-hover:text-blue-300 line-clamp-2">{t.subject}</h4>
                    <div className="text-xs opacity-50 mb-2">{t.account_name}</div>
                    
                    {t.milestone_name && (
                        <div className="mt-2 pt-2 border-t border-slate-700">
                            <Badge variant="info">{t.milestone_name}</Badge>
                        </div>
                    )}
                </div>
            )}
          />
      )}
    </Layout>
  );
}