import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Edit2, Save } from 'lucide-react';

export default function ClientInfoCard({ client, isEditing, form, setForm, onSave, onCancel, onEdit, isNaked }) {
  return (
    <Card title="Details" action={
        isEditing ? (
            <div className="flex gap-2">
                <Button variant="secondary" onClick={onCancel} size="sm">Cancel</Button>
                <Button variant="success" icon={Save} onClick={onSave} size="sm">Save</Button>
            </div>
        ) : (
            <Button variant="secondary" icon={Edit2} onClick={onEdit} size="sm">Edit</Button>
        )
    }>
        <div className="space-y-4">
            <div>
            <p className="text-xs uppercase text-slate-500">Status</p>
            {isEditing ? (
                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white mt-1">
                    <option value="lead">Lead</option><option value="prospect">Prospect</option><option value="client">Active Client</option><option value="churned">Churned</option>
                </select>
            ) : <p className="text-white">{client.status}</p>}
            </div>
            {!isNaked && isEditing && (
            <div>
                <p className="text-xs uppercase text-slate-500">Brand Sovereignty</p>
                <select value={form.brand_affinity} onChange={(e) => setForm({...form, brand_affinity: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white mt-1">
                    <option value="ds">Digital Sanctum</option><option value="nt">Naked Tech</option><option value="both">Shared</option>
                </select>
            </div>
            )}
            <div>
            <p className="text-xs uppercase text-slate-500">Type</p>
            {isEditing ? (
                <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white mt-1">
                    <option value="business">Business</option><option value="residential">Residential</option>
                </select>
            ) : <p className="text-white capitalize">{client.type}</p>}
            </div>
            <div>
                <p className="text-xs uppercase text-slate-500">Billing Email</p>
                {isEditing ? (
                  <input className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white mt-1" value={form.billing_email} onChange={e => setForm({...form, billing_email: e.target.value})} />
                ) : <p className="text-white">{client.billing_email || '-'}</p>}
            </div>
        </div>
    </Card>
  );
}