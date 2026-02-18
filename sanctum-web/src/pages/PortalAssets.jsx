import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Server, Search, Wifi, HardDrive, Globe, AlertCircle, Loader2 } from 'lucide-react';
import usePortalNav from '../hooks/usePortalNav';


export default function PortalAssets() {
  const navigate = useNavigate();
  const { portalNav, impersonateId } = usePortalNav();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const imp = impersonateId ? `?impersonate=${impersonateId}` : '';
      const res = await api.get(`/portal/assets${imp}`);
      setAssets(res.data);
    } catch (e) {
      console.error("Failed to load assets", e);
    } finally {
      setLoading(false);
    }
  };

  // FILTER LOGIC
  const filtered = assets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    (a.ip_address && a.ip_address.includes(search)) ||
    (a.serial_number && a.serial_number.toLowerCase().includes(search.toLowerCase()))
  );

  // ICON HELPER
  const getIcon = (type) => {
      switch(type?.toLowerCase()) {
          case 'server': return <Server size={16} className="text-purple-400" />;
          case 'network': return <Wifi size={16} className="text-blue-400" />;
          case 'workstation': 
          case 'laptop': return <HardDrive size={16} className="text-green-400" />;
          case 'domain':
          case 'hosting': return <Globe size={16} className="text-cyan-400" />;
          default: return <Server size={16} className="text-slate-400" />;
      }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <button 
                    onClick={() => portalNav('/portal')}
                    className="flex items-center text-slate-400 hover:text-white transition-colors mb-4 text-sm"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Server className="text-sanctum-gold" />
                    Asset Inventory
                </h1>
                <p className="text-slate-500 text-sm mt-1">Hardware, Software, and Digital Assets managed by Sanctum.</p>
            </div>

            {/* SEARCH */}
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input 
                    className="w-full bg-black/20 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-sanctum-gold transition-colors text-white placeholder:text-slate-600"
                    placeholder="Search inventory..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
        </div>

        {/* TABLE */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-500 uppercase text-xs font-bold">
                        <tr>
                            <th className="p-4">Asset Name</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Details (IP/Serial)</th>
                            <th className="p-4">Expiry</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filtered.length > 0 ? filtered.map(asset => (
                            <tr key={asset.id} className="hover:bg-white/5 transition-colors group">
                                <td className="p-4 font-bold text-white flex items-center gap-3">
                                    <div className="p-2 bg-slate-900 rounded border border-slate-700 group-hover:border-slate-500 transition-colors">
                                        {getIcon(asset.asset_type)}
                                    </div>
                                    {asset.name}
                                </td>
                                <td className="p-4 text-slate-400 capitalize">{asset.asset_type}</td>
                                <td className="p-4 font-mono text-xs text-slate-400">
                                    {asset.ip_address && <div className="mb-1">IP: {asset.ip_address}</div>}
                                    {asset.serial_number && <div>SN: {asset.serial_number}</div>}
                                    {!asset.ip_address && !asset.serial_number && <span className="opacity-30">-</span>}
                                </td>
                                <td className="p-4 text-slate-400">
                                    {asset.expires_at ? (
                                        <span className={new Date(asset.expires_at) < new Date() ? "text-red-400 font-bold" : ""}>
                                            {formatDate(asset.expires_at)}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                                        asset.status === 'active' ? 'bg-green-500/20 text-green-500' : 
                                        asset.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-500' : 
                                        'bg-slate-700 text-slate-400'
                                    }`}>
                                        {asset.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="p-12 text-center text-slate-500">
                                    <AlertCircle className="mx-auto mb-2 opacity-50" size={24} />
                                    <p>No assets found.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  );
}