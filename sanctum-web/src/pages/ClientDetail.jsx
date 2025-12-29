import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Get ID from URL
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, ArrowLeft, Mail, Phone, Shield, FileText, AlertCircle } from 'lucide-react';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';

  // Theme colors
  const cardBg = isNaked ? "bg-white border-slate-200" : "bg-slate-800 border-slate-700";
  const labelColor = isNaked ? "text-slate-500" : "text-slate-400";
  const valueColor = isNaked ? "text-slate-900" : "text-white";

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await api.get(`/accounts/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClient(response.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.status === 403 ? "Access Forbidden" : "Failed to load client");
      } finally {
        setLoading(false);
      }
    };
    if (token && id) fetchDetail();
  }, [token, id]);

  if (loading) return <Layout title="Loading..."><div className="p-8 opacity-50"><Loader2 className="animate-spin"/></div></Layout>;
  if (error) return <Layout title="Error"><div className="p-8 text-red-500">{error}</div></Layout>;
  if (!client) return null;

  return (
    <Layout title="Client Profile">
      
      {/* 1. HEADER / ACTIONS */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/clients')} className="p-2 rounded-full hover:bg-white/10 opacity-70">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded ${client.status === 'lead' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
              {client.status}
            </span>
            <span className="text-xs opacity-50 uppercase tracking-widest">{client.id}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. LEFT COLUMN: CONTACTS & INTELLIGENCE */}
        <div className="space-y-8">
          
          {/* Contacts Card */}
          <div className={`p-6 rounded-xl border ${cardBg}`}>
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
              <UsersIcon /> Key Contacts
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

          {/* Audit Data (The Form Submission) - Only show if exists */}
          {client.audit_data && (
            <div className={`p-6 rounded-xl border ${cardBg}`}>
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2">
                <FileText size={16} /> Submission Data
              </h3>
              <div className="space-y-3 text-sm">
                {Object.entries(client.audit_data).map(([key, val]) => (
                  <div key={key}>
                    <p className={`text-xs uppercase ${labelColor}`}>{key.replace('_', ' ')}</p>
                    <p className={`${valueColor} break-words`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. RIGHT COLUMN: WORKFLOWS (Deals/Tickets) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Brand A: Deals (Only show for Sanctum/Global) */}
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

          {/* Brand B: Tickets (Always show) */}
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

function UsersIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
