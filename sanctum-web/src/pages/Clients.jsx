import React, { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Loader2, Building, Home } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // <--- Import

const api = axios.create({ baseURL: '/api' });

export default function Clients() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const scope = user?.scope || 'guest';
  const isNaked = scope === 'nt_only';
  const isGlobal = scope === 'global';

  // Styles for the table
  const tableHeadClass = isNaked ? "text-slate-500 bg-slate-100" : "text-sanctum-gold bg-slate-800";
  const rowClass = isNaked ? "border-slate-100 hover:bg-slate-50 text-slate-800" : "border-slate-800 hover:bg-white/5 text-slate-300";

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await api.get('/accounts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClients(response.data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    if (token) fetchClients();
  }, [token]);

  return (
    <Layout title="Client Registry">
      {loading ? (
        <div className="flex items-center gap-2 opacity-50"><Loader2 className="animate-spin" /> Fetching Database...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-opacity-20 border-gray-500">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-xs uppercase tracking-wider ${tableHeadClass}`}>
                <th className="p-4">Entity Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                {/* CONDITIONAL COLUMN: Only show Brand Affinity to CEO */}
                {isGlobal && <th className="p-4">Brand</th>}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className={`border-b transition-colors ${rowClass}`}>
                  <td className="p-4 font-medium">{client.name}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-2 opacity-70">
                      {client.type === 'business' ? <Building size={14}/> : <Home size={14}/>}
                      {client.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      client.status === 'client' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  
                  {isGlobal && (
                    <td className="p-4 opacity-50 uppercase text-xs">{client.brand_affinity}</td>
                  )}
                  
                  <td className="p-4 text-right">
		      <button
  onClick={() => navigate(`/clients/${client.id}`)}
  className="text-xs font-bold opacity-50 hover:opacity-100 uppercase"
>
  View Profile
</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {clients.length === 0 && (
            <div className="p-8 text-center opacity-50">No clients found in this sector.</div>
          )}
        </div>
      )}
    </Layout>
  );
}
