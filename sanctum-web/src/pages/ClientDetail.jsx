import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Mail, Users, Shield, FileText, AlertCircle, Edit2, Save, X } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // EDIT STATE
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  const cardBg = isNaked ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700";
  const labelColor = isNaked ? "text-slate-500" : "text-slate-400";
  const valueColor = isNaked ? "text-slate-900" : "text-white";
  const inputClass = isNaked
    ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-pink-500"
    : "bg-black/20 border-white/10 text-white focus:border-sanctum-gold";

  useEffect(() => {
    fetchDetail();
  }, [token, id]);

  const fetchDetail = async () => {
    try {
      const response = await api.get(`/accounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClient(response.data);
      // Initialize form data
      setFormData({
        name: response.data.name,
        status: response.data.status,
        type: response.data.type
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.status === 403 ? "Access Forbidden" : "Failed to load client");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/accounts/${id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsEditing(false);
      fetchDetail(); // Refresh data
    } catch (err) {
      alert("Failed to save updates.");
      console.error(err);
    }
  };

  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;
  if (error) return <Layout title="Error"><div className="p-8 text-red-500">{error}</div></Layout>;
  if (!client) return null;

  return (
    <Layout title="Client Profile">

      {/* 1. HEADER / ACTIONS */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="p-2 rounded-full hover:bg-white/10 opacity-70">
            <ArrowLeft size={20} />
          </button>

          {isEditing ? (
            <input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`text-2xl font-bold px-2 py-1 rounded border ${inputClass} outline-none`}
            />
          ) : (
            <div>
              <h1 className="text-3xl font-bold">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${client.status === 'lead' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                  {client.status}
                </span>
                <span className="text-xs opacity-50 uppercase tracking-widest">{client.id}</span>
              </div>
            </div>
          )}
        </div>

        {/* EDIT ACTIONS */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-500">
                <X size={16} /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500">
                <Save size={16} /> Save Changes
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className={`flex items-center gap-2 px-4 py-2 rounded border transition-colors ${isNaked ? 'border-slate-300 hover:bg-slate-50' : 'border-white/20 hover:bg-white/5'}`}>
              <Edit2 size={16} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 2. LEFT COLUMN: DETAILS & CONTACTS */}
        <div className="space-y-8">

          {/* Main Info Card */}
          <div className={`p-6 rounded-xl border ${cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Details</h3>
            <div className="space-y-4">
              <div>
                <p className={`text-xs uppercase ${labelColor}`}>Status</p>
                {isEditing ? (
                   <select
                     value={formData.status}
                     onChange={(e) => setFormData({...formData, status: e.target.value})}
                     className={`w-full mt-1 p-2 rounded border ${inputClass}`}
                   >
                     <option value="lead">Lead</option>
                     <option value="prospect">Prospect</option>
                     <option value="client">Active Client</option>
                     <option value="churned">Churned</option>
                   </select>
                ) : (
                  <p className={valueColor}>{client.status}</p>
                )}
              </div>
              <div>
                <p className={`text-xs uppercase ${labelColor}`}>Type</p>
                {isEditing ? (
                   <select
                     value={formData.type}
                     onChange={(e) => setFormData({...formData, type: e.target.value})}
                     className={`w-full mt-1 p-2 rounded border ${inputClass}`}
                   >
                     <option value="business">Business</option>
                     <option value="residential">Residential</option>
                   </select>
                ) : (
                  <p className={valueColor}>{client.type}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contacts Card */}
          <div className={`p-6 rounded-xl border ${cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
              <Users size={16} /> Key Contacts
            </h3>
            <div className="space-y-4">
              {client.contacts.map(c => (
                <div key={c.id} className="pb-4 border-b border-gray-500/20 last:border-0 last:pb-0">
                  <p className={`font-bold ${valueColor}`}>{c.first_name} {c.last_name} {c.is_primary_contact && '⭐'}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                    <Mail size={12} /> {c.email}
                  </div>
                </div>
              ))}
              {client.contacts.length === 0 && <p className="opacity-50 text-sm">No contacts linked.</p>}
            </div>
          </div>
        </div>

        {/* 3. RIGHT COLUMN: WORKFLOWS (Unchanged) */}
        <div className="lg:col-span-2 space-y-8">
           {/* Brand A: Deals */}
          {!isNaked && (
            <div className={`p-6 rounded-xl border ${cardBg}`}>
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-sanctum-gold flex items-center gap-2">
                <Shield size={16} /> Commercial Pipeline
              </h3>
              {client.deals.length > 0 ? (
                <div className="grid gap-4">
                  {client.deals.map(deal => (
                    <div key={deal.id} className="flex justify-between items-center p-4 rounded bg-black/20 border border-white/5">
                      <span className="font-medium">{deal.title}</span>
                      <span className="font-mono text-sanctum-gold">${deal.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="opacity-50 text-sm italic">No active deals.</p>
              )}
            </div>
          )}

          {/* Brand B: Tickets */}
          <div className={`p-6 rounded-xl border ${cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 text-pink-500 flex items-center gap-2">
              <AlertCircle size={16} /> Technical Support
            </h3>
             {client.tickets.length > 0 ? (
                <div className="grid gap-4">
                  {client.tickets.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 rounded bg-black/20 border border-white/5">
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded mr-2 uppercase ${t.priority === 'high' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                          {t.priority}
                        </span>
                        <span className="font-medium">{t.subject}</span>
                      </div>
                      <span className="text-xs opacity-50 uppercase">{t.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="opacity-50 text-sm italic">No open tickets.</p>
              )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
