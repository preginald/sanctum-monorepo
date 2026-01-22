import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, UserPlus, Edit2, User, Trash2, Key, Users } from 'lucide-react';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useToast } from '../context/ToastContext';

export default function AdminUserList() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  
  // MODALS
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'tech' });
  const [actionLoading, setActionLoading] = useState(false);
  
  const [confirm, setConfirm] = useState({ isOpen: false, title: '', message: '', action: null });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
      try {
          const res = await api.get('/admin/users');
          setUsers(res.data);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
  };

  const handleSave = async (e) => {
      e.preventDefault();
      setActionLoading(true);
      try {
          if (editingId) {
              await api.put(`/admin/users/${editingId}`, { full_name: newUser.full_name, email: newUser.email });
              addToast("User updated", "success");
          } else {
              await api.post('/admin/users', newUser, { params: { role: newUser.role, access_scope: 'global' } });
              addToast("User created", "success");
          }
          setShowCreate(false);
          setNewUser({ email: '', full_name: '', password: '', role: 'tech' });
          setEditingId(null);
          fetchUsers();
      } catch(e) {
          addToast("Action failed", "danger");
      } finally { setActionLoading(false); }
  };


  const handleEdit = (user) => {
      setNewUser({ email: user.email, full_name: user.full_name, password: '', role: user.role });
      setEditingId(user.id);
      setShowCreate(true);
  };

  const handleDelete = async (uid) => {
      try {
          await api.delete(`/admin/users/${uid}`);
          addToast("User removed", "info");
          fetchUsers();
      } catch(e) { addToast("Failed to remove user", "danger"); }
  };

  if (loading) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout title="Staff Roster">
      <ConfirmationModal 
        isOpen={confirm.isOpen} onClose={() => setConfirm({...confirm, isOpen: false})} 
        title={confirm.title} message={confirm.message} onConfirm={confirm.action} isDangerous={true} 
      />

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-900/20 rounded-full text-purple-400 border border-purple-500/30">
                  <Users size={24} />
              </div>
              <div>
                  <h1 className="text-2xl font-bold">User Administration</h1>
                  <p className="text-slate-500 text-sm">Manage access and roles.</p>
              </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 font-bold rounded shadow-lg hover:bg-yellow-500 transition-colors">
              <UserPlus size={18} /> Add User
          </button>
      </div>

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-slate-500 uppercase text-xs font-bold">
                  <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Scope</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                  {users.map(u => (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                              <div className="font-bold text-white">{u.full_name}</div>
                              <div className="text-xs font-mono text-slate-500">{u.email}</div>
                          </td>
                          <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-900 text-purple-400' : (u.role === 'client' ? 'bg-slate-700 text-slate-300' : 'bg-blue-900 text-blue-400')}`}>
                                  {u.role}
                              </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400">{u.access_scope}</td>
                          <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(u)} className="text-slate-500 hover:text-white p-2 mr-1">
                                  <Edit2 size={16} />
                              </button>
                              <button onClick={() => setConfirm({ isOpen: true, title: "Delete User?", message: "This cannot be undone.", action: () => handleDelete(u.id) })} className="text-slate-500 hover:text-red-500 p-2">
                                  <Trash2 size={16} />
                              </button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Onboard New Staff">
          <form onSubmit={handleSave} className="space-y-4">
              <div><label className="text-xs opacity-50 block mb-1">Full Name</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Email</label><input required type="email" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Initial Password</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Role</label><select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}><option value="tech">Technician</option><option value="admin">Administrator</option></select></div>
              <button disabled={actionLoading} type="submit" className="w-full py-2 bg-sanctum-gold text-slate-900 font-bold rounded flex items-center justify-center gap-2">{actionLoading && <Loader2 className="animate-spin" size={16}/>} Create User</button>
          </form>
      </Modal>
    </Layout>
  );
}