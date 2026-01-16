import React from 'react';
import Modal from '../ui/Modal'; 
import { Loader2 } from 'lucide-react';
// NEW IMPORT
import { CONTACT_PERSONAS } from '../../lib/constants';

export default function ClientModals({ activeModal, onClose, onSubmit, loading, forms, setForms }) {
  
  const handleChange = (formName, field, value) => {
      setForms(prev => ({
          ...prev,
          [formName]: { ...prev[formName], [field]: value }
      }));
  };

  return (
    <>
      {/* 1. ADD PROJECT */}
      <Modal isOpen={activeModal === 'project'} onClose={onClose} title="Initialize Project">
          <form onSubmit={onSubmit} className="space-y-4">
              <div><label className="text-xs opacity-50 block mb-1">Project Name</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.project.name} onChange={e => handleChange('project', 'name', e.target.value)} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Budget ($)</label><input type="number" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.project.budget} onChange={e => handleChange('project', 'budget', parseFloat(e.target.value))} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Due Date</label><input type="date" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.project.due_date} onChange={e => handleChange('project', 'due_date', e.target.value)} /></div>
              <button type="submit" disabled={loading} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex justify-center items-center gap-2">{loading && <Loader2 className="animate-spin" size={16}/>} Create Project</button>
          </form>
      </Modal>

      {/* 2. ADD DEAL */}
      <Modal isOpen={activeModal === 'deal'} onClose={onClose} title="New Opportunity">
          <form onSubmit={onSubmit} className="space-y-4">
              <div><label className="text-xs opacity-50 block mb-1">Title</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.deal.title} onChange={e => handleChange('deal', 'title', e.target.value)} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Value ($)</label><input required type="number" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.deal.amount} onChange={e => handleChange('deal', 'amount', parseFloat(e.target.value))} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Stage</label><select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.deal.stage} onChange={e => handleChange('deal', 'stage', e.target.value)}><option value="Infiltration">Infiltration</option><option value="Accession">Accession</option><option value="Lost">Lost</option></select></div>
              <button type="submit" disabled={loading} className="w-full py-2 bg-sanctum-gold hover:bg-yellow-500 text-slate-900 font-bold rounded flex justify-center items-center gap-2">{loading && <Loader2 className="animate-spin" size={16}/>} Create Deal</button>
          </form>
      </Modal>

      {/* 3. ADD/EDIT CONTACT (UPDATED) */}
      <Modal isOpen={activeModal === 'contact'} onClose={onClose} title={forms.contact.id ? "Edit Human" : "Add Human"}>
          <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs opacity-50 block mb-1">First Name</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.contact.first_name} onChange={e => handleChange('contact', 'first_name', e.target.value)} /></div>
                  <div><label className="text-xs opacity-50 block mb-1">Last Name</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.contact.last_name} onChange={e => handleChange('contact', 'last_name', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs opacity-50 block mb-1">Email</label><input required type="email" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.contact.email} onChange={e => handleChange('contact', 'email', e.target.value)} /></div>
                  <div><label className="text-xs opacity-50 block mb-1">Phone</label><input className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.contact.phone} onChange={e => handleChange('contact', 'phone', e.target.value)} /></div>
              </div>
              
              {/* UPDATED: Persona Dropdown */}
              <div>
                  <label className="text-xs opacity-50 block mb-1">Role / Persona</label>
                  <select 
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" 
                      value={forms.contact.persona || ''} 
                      onChange={e => handleChange('contact', 'persona', e.target.value)}
                  >
                      <option value="">-- Select Role --</option>
                      {CONTACT_PERSONAS.map(p => (
                          <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
              </div>
              
              <button type="submit" disabled={loading} className="w-full py-2 bg-sanctum-blue text-white font-bold rounded flex justify-center items-center gap-2">{loading && <Loader2 className="animate-spin" size={16}/>} Save Contact</button>
          </form>
      </Modal>

      {/* 4. ADD USER */}
      <Modal isOpen={activeModal === 'user'} onClose={onClose} title="Grant Portal Access">
          <form onSubmit={onSubmit} className="space-y-4">
              <div><label className="text-xs opacity-50 block mb-1">Email (Login)</label><input required type="email" className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.user.email} onChange={e => handleChange('user', 'email', e.target.value)} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Full Name</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.user.full_name} onChange={e => handleChange('user', 'full_name', e.target.value)} /></div>
              <div><label className="text-xs opacity-50 block mb-1">Initial Password</label><input required className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={forms.user.password} onChange={e => handleChange('user', 'password', e.target.value)} /></div>
              <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs text-yellow-500">
                  User will receive an email notification with credentials.
              </div>
              <button type="submit" disabled={loading} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex justify-center items-center gap-2">{loading && <Loader2 className="animate-spin" size={16}/>} Create User</button>
          </form>
      </Modal>
    </>
  );
}