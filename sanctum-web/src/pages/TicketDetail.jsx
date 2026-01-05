import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CommentStream from '../components/CommentStream';
import { Loader2, ArrowLeft, Save, Edit2, CheckCircle, Clock, FileText, User, X } from 'lucide-react';
import api from '../lib/api';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [contacts, setContacts] = useState([]); // All available contacts for the client
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    status: '',
    priority: '',
    description: '',
    resolution: '',
    contact_ids: [] // <--- Initialize as Array to prevent crash
  });

  useEffect(() => { fetchTicket(); }, [id]);

  const fetchTicket = async () => {
    try {
      // 1. Get Ticket Data
      const res = await api.get('/tickets'); 
      const target = res.data.find(t => t.id === parseInt(id));
      
      if (target) {
        setTicket(target);
        
        // 2. Map existing linked contacts to IDs
        const existingIds = target.contacts ? target.contacts.map(c => c.id) : [];

        setFormData({
          status: target.status,
          priority: target.priority,
          description: target.description || '',
          resolution: target.resolution || '',
          contact_ids: existingIds 
        });

        // 3. Fetch All Contacts for this Account (to populate dropdown)
        fetchContacts(target.account_id);
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const fetchContacts = async (accountId) => {
    try {
      const res = await api.get(`/accounts/${accountId}`);
      if (res.data && res.data.contacts) {
        setContacts(res.data.contacts);
      }
    } catch (e) { console.error("Failed to load contacts for ticket", e); }
  };

  const handleSave = async () => {
    if (formData.status === 'resolved' && !formData.resolution.trim()) {
      alert("Resolution note is required to close a ticket.");
      return;
    }
    try {
      await api.put(`/tickets/${id}`, formData);
      await fetchTicket(); 
      setIsEditing(false); 
    } catch (e) { alert("Update failed"); }
  };

  // CONTACT TOGGLE LOGIC
  const toggleContact = (contactId) => {
    const current = formData.contact_ids;
    if (current.includes(contactId)) {
      setFormData({ ...formData, contact_ids: current.filter(x => x !== contactId) });
    } else {
      setFormData({ ...formData, contact_ids: [...current, contactId] });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getPriorityColor = (p) => {
    switch(p) {
      case 'critical': return 'bg-red-500/20 text-red-500';
      case 'high': return 'bg-orange-500/20 text-orange-500';
      case 'low': return 'bg-green-500/20 text-green-500';
      default: return 'bg-blue-500/20 text-blue-500';
    }
  };

  if (loading || !ticket) return <Layout title="Loading..."><Loader2 className="animate-spin" /></Layout>;

  return (
    <Layout title={`Ticket #${ticket.id}`}>
      
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/tickets')} className="p-2 rounded hover:bg-white/10 opacity-70"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <p className="opacity-50 text-sm flex items-center gap-2">
              {ticket.account_name} 
              {/* Show Linked Contacts in Header */}
              {ticket.contact_name && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-xs text-sanctum-gold">
                  <User size={10} /> {ticket.contact_name}
                </span>
              )}
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors">
            <Edit2 size={16} /> Edit Ticket
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-bold">
              <Save size={16} /> Save Changes
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: TICKET DATA */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-xl relative">
            
            {/* --- READ MODE --- */}
            {!isEditing && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Status</label>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${ticket.status === 'resolved' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1">Priority</label>
                    <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <label className="text-xs uppercase opacity-50 block mb-2 flex items-center gap-2">
                    <FileText size={12} /> Description
                  </label>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {ticket.description || <span className="opacity-30 italic">No description provided.</span>}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1"><Clock size={12}/> Opened</label>
                    <span className="text-sm font-mono opacity-80">{formatDate(ticket.created_at)}</span>
                  </div>
                  <div>
                    <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1 text-yellow-500"><Clock size={12}/> Last Modified</label>
                    <span className="text-sm font-mono opacity-80">{ticket.updated_at ? formatDate(ticket.updated_at) : 'Never'}</span>
                  </div>
                </div>
                
                {ticket.closed_at && (
                  <div className="pt-2">
                    <label className="text-xs uppercase opacity-50 block mb-1 flex items-center gap-1 text-green-500"><CheckCircle size={12}/> Closed</label>
                    <span className="text-sm font-mono opacity-80">{formatDate(ticket.closed_at)}</span>
                  </div>
                )}

                {ticket.resolution && (
                  <div className="pt-4 border-t border-slate-800">
                    <label className="text-xs uppercase opacity-50 block mb-2 text-green-400">Resolution Note</label>
                    <div className="p-3 bg-green-900/10 border border-green-900/30 rounded text-sm text-gray-300">
                      {ticket.resolution}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- EDIT MODE --- */}
            {isEditing && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase opacity-50 mb-1">Status</label>
                    <select className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-blue outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase opacity-50 mb-1">Priority</label>
                    <select className="w-full p-3 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-blue outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                      <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* MULTI-CONTACT SELECTOR */}
                <div>
                  <label className="block text-xs uppercase opacity-50 mb-1">Affected Humans</label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[30px] p-2 bg-black/20 rounded border border-slate-700">
                    {formData.contact_ids.length === 0 && <span className="text-xs opacity-30 italic">No contacts linked</span>}
                    {formData.contact_ids.map(id => {
                      const c = contacts.find(x => x.id === id);
                      return c ? (
                        <span key={id} className="bg-sanctum-blue/20 text-sanctum-blue px-2 py-1 rounded text-xs flex items-center gap-1 border border-sanctum-blue/30">
                          {c.first_name} {c.last_name}
                          <button onClick={() => toggleContact(id)} className="hover:text-white"><X size={12}/></button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  
                  <select 
                    className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white text-sm"
                    onChange={(e) => { if(e.target.value) toggleContact(e.target.value); }}
                    value=""
                  >
                    <option value="">+ Add Person</option>
                    {contacts.filter(c => !formData.contact_ids.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.persona || 'Staff'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase opacity-50 mb-1">Description</label>
                  <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white focus:border-sanctum-blue outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detailed issue description..." />
                </div>

                <div className={`transition-all duration-300 ${formData.status === 'resolved' ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                  <label className="block text-xs uppercase opacity-50 mb-1 flex items-center gap-2"><CheckCircle size={12} className="text-green-500" /> Resolution Note {formData.status === 'resolved' && '*'}</label>
                  <textarea className="w-full p-3 h-32 rounded bg-black/40 border border-slate-600 text-white focus:border-green-500 outline-none" value={formData.resolution} onChange={e => setFormData({...formData, resolution: e.target.value})} placeholder="Describe the fix..." disabled={formData.status !== 'resolved'} />
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="h-[600px]">
          <CommentStream resourceType="ticket" resourceId={ticket.id} />
        </div>
      </div>
    </Layout>
  );
}