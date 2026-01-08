import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Loader2, Package, DollarSign, Trash2, Plus } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function Catalog() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '', description: '', type: 'service', unit_price: ''
  });

  const isAdmin = user?.scope === 'global';

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
        await api.post('/products', formData);
        setShowForm(false);
        setFormData({ name: '', description: '', type: 'service', unit_price: '' });
        fetchProducts();
    } catch (e) { alert("Failed to create product"); }
  };

  const handleDelete = async (id) => {
      if(!confirm("Archive this product?")) return;
      try {
          await api.delete(`/products/${id}`);
          fetchProducts();
      } catch (e) { alert("Failed"); }
  };

  return (
    <Layout title="Service & Hardware Catalog">
      <div className="flex justify-end mb-6">
        {isAdmin && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-sanctum-gold text-slate-900 rounded font-bold hover:bg-yellow-500">
                <Plus size={18} /> Add Item
            </button>
        )}
      </div>

      {showForm && (
          <div className="mb-6 p-6 bg-slate-800 rounded border border-slate-700">
              <h3 className="font-bold mb-4 text-white">New Catalogue Item</h3>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2">
                      <label className="text-xs text-slate-400 block mb-1">Item Name</label>
                      <input required className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Server Maintenance" />
                  </div>
                  <div>
                      <label className="text-xs text-slate-400 block mb-1">Type</label>
                      <select className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                          <option value="service">Service (Labor)</option>
                          <option value="hardware">Hardware (Goods)</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-xs text-slate-400 block mb-1">Unit Price ($)</label>
                      <input required type="number" step="0.01" className="w-full p-2 rounded bg-black/40 border border-slate-600 text-white" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} />
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                      <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded font-bold text-sm">Save Item</button>
                      <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-700 text-white rounded text-sm">Cancel</button>
                  </div>
              </form>
          </div>
      )}

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-500">
                  <tr>
                      <th className="p-4">Type</th>
                      <th className="p-4">Item Name</th>
                      <th className="p-4 text-right">Unit Price</th>
                      {isAdmin && <th className="p-4 text-right">Action</th>}
                  </tr>
              </thead>
              <tbody>
                  {products.map(p => (
                      <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${p.type === 'service' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                  {p.type}
                              </span>
                          </td>
                          <td className="p-4">
                              <div className="font-bold text-white">{p.name}</div>
                              <div className="text-xs opacity-50">{p.description}</div>
                          </td>
                          <td className="p-4 text-right font-mono text-sanctum-gold">
                              ${p.unit_price.toFixed(2)}
                          </td>
                          {isAdmin && (
                              <td className="p-4 text-right">
                                  <button onClick={() => handleDelete(p.id)} className="text-red-500 opacity-50 hover:opacity-100"><Trash2 size={16} /></button>
                              </td>
                          )}
                      </tr>
                  ))}
              </tbody>
          </table>
          {products.length === 0 && !loading && <div className="p-8 text-center opacity-30">Catalog is empty.</div>}
      </div>
    </Layout>
  );
}