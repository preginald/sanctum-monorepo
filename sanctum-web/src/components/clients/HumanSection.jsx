import React from 'react';
import { User, Shield, Edit2, Trash2, UserPlus, Key } from 'lucide-react';

export default function HumanSection({ contacts, users, onAddContact, onEditContact, onDeleteContact, onAddUser, onRevokeUser, isEditing }) {
  
  return (
    <div className="space-y-6">
      
      {/* CONTACTS LIST */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
            <User size={16} /> Key Contacts
          </h3>
          {!isEditing && (
            <button onClick={onAddContact} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors">
              <UserPlus size={16} />
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {contacts.map(contact => (
            <div key={contact.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded border border-slate-700 group hover:border-slate-600 transition-colors">
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  {contact.first_name} {contact.last_name}
                  {contact.is_primary_contact && <span className="text-[10px] bg-blue-600 px-1.5 rounded text-white">PRIMARY</span>}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {contact.email} • {contact.persona || 'N/A'}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEditContact(contact)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                <button onClick={() => onDeleteContact(contact.id)} className="p-1.5 hover:bg-red-900/30 rounded text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-sm opacity-30 italic">No contacts listed.</p>}
        </div>
      </div>

      {/* PORTAL USERS */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-widest text-slate-400">
            <Shield size={16} /> Portal Access
          </h3>
          {!isEditing && (
            <button onClick={onAddUser} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors">
              <Key size={16} />
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded border border-slate-700 group">
              <div>
                <div className="font-bold text-white">{u.full_name}</div>
                <div className="text-xs text-slate-500 font-mono">{u.email}</div>
              </div>
              <button 
                onClick={() => onRevokeUser(u.id)} 
                className="text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-red-900/20 rounded"
              >
                Revoke
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm opacity-30 italic">No active portal accounts.</p>}
        </div>
      </div>

    </div>
  );
}