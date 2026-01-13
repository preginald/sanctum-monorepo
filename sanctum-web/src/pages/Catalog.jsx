import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Trash2, Plus } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

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

  if (loading) {
    return (
      <Layout title="Service & Hardware Catalog">
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout title="Service & Hardware Catalog">
      <div className="flex justify-end mb-6">
        {isAdmin && !showForm && (
            <Button 
              onClick={() => setShowForm(true)} 
              icon={Plus}
              className="bg-sanctum-gold text-slate-900 hover:bg-yellow-500 border-none"
            >
                Add Item
            </Button>
        )}
      </div>

      {showForm && (
          <Card title="New Catalogue Item" className="mb-6">
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2">
                      <Input 
                        label="Item Name"
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="e.g. Server Maintenance" 
                      />
                  </div>
                  <div>
                      <Select 
                        label="Type"
                        value={formData.type} 
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                          <option value="service">Service (Labor)</option>
                          <option value="hardware">Hardware (Goods)</option>
                      </Select>
                  </div>
                  <div>
                      <Input 
                        label="Unit Price ($)"
                        required 
                        type="number" 
                        step="0.01" 
                        value={formData.unit_price} 
                        onChange={e => setFormData({...formData, unit_price: e.target.value})} 
                      />
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                      <Button type="submit" variant="success">Save Item</Button>
                      <Button onClick={() => setShowForm(false)} variant="outline">Cancel</Button>
                  </div>
              </form>
          </Card>
      )}

      <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm text-white">
              <thead className="bg-black/20 text-xs uppercase font-bold text-slate-500">
                  <tr>
                      <th className="p-4">Type</th>
                      <th className="p-4">Item Name</th>
                      <th className="p-4 text-right">Unit Price</th>
                      {isAdmin && <th className="p-4 text-right">Action</th>}
                  </tr>
              </thead>
              <tbody>
                  {products.map(p => (
                      <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-4">
                              <Badge variant={p.type === 'service' ? 'info' : 'warning'}>
                                  {p.type}
                              </Badge>
                          </td>
                          <td className="p-4">
                              <div className="font-bold text-white">{p.name}</div>
                              <div className="text-xs opacity-50">{p.description}</div>
                          </td>
                          <td className="p-4 text-right font-mono text-sanctum-gold">
                              ${Number(p.unit_price).toFixed(2)}
                          </td>
                          {isAdmin && (
                              <td className="p-4 text-right">
                                  <button 
                                    onClick={() => handleDelete(p.id)} 
                                    className="text-red-500 opacity-50 hover:opacity-100 transition-opacity"
                                    title="Archive Product"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                              </td>
                          )}
                      </tr>
                  ))}
              </tbody>
          </table>
          {products.length === 0 && <div className="p-8 text-center opacity-30">Catalog is empty.</div>}
      </Card>
    </Layout>
  );
}
