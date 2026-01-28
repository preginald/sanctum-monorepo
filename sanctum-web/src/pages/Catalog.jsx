import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Trash2, Plus, Calendar } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';
import Input from '../components/ui/Input';   // RESTORED
import Select from '../components/ui/Select'; // RESTORED
import { useToast } from '../context/ToastContext';
import { PRODUCT_TYPES } from '../lib/constants';

export default function Catalog() {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '', 
      description: '', 
      type: 'service', 
      unit_price: '',
      is_recurring: false,      
      billing_frequency: ''     
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
        const payload = { ...formData };
        if (!payload.is_recurring) {
            payload.billing_frequency = null;
        }
        await api.post('/products', payload);
        setShowForm(false);
        setFormData({ name: '', description: '', type: 'service', unit_price: '', is_recurring: false, billing_frequency: '' });
        addToast("Product added to catalog", "success");
        fetchProducts();
    } catch (e) { 
        addToast("Failed to create product", "error");
    }
  };

  const handleDelete = async (id) => {
      if(!confirm("Archive this product?")) return;
      try {
          await api.delete(`/products/${id}`);
          addToast("Product archived", "info");
          fetchProducts();
      } catch (e) { 
          addToast("Failed to archive product", "error");
      }
  };

  const getTypeInfo = (value) => PRODUCT_TYPES.find(t => t.value === value) || { label: value, color: 'default' };

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
          <div className="mb-6 bg-slate-800 border border-slate-700 p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
              <h3 className="text-lg font-bold text-white mb-4">New Catalogue Item</h3>
              
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  
                  {/* RESTORED: Use UI Kit Input */}
                  <div className="md:col-span-2">
                      <Input 
                        label="Item Name"
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="e.g. Server Maintenance" 
                        autoFocus
                      />
                  </div>
                  
                  {/* RESTORED: Use UI Kit Select */}
                  <div>
                      <Select 
                        label="Type"
                        value={formData.type} 
                        onChange={e => setFormData({...formData, type: e.target.value})}
                      >
                          {PRODUCT_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
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

                  {/* RECURRING BILLING TOGGLE */}
                  <div className="md:col-span-4 flex items-center gap-4 py-4 border-t border-slate-700 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={formData.is_recurring} 
                            onChange={e => setFormData({...formData, is_recurring: e.target.checked})}
                            className="w-4 h-4 rounded border-slate-600 text-sanctum-gold focus:ring-sanctum-gold bg-slate-900 cursor-pointer"
                          />
                          <span className="text-sm font-bold text-white">Recurring Service?</span>
                      </label>

                      {formData.is_recurring && (
                          <div className="w-48">
                              <Select 
                                value={formData.billing_frequency} 
                                onChange={e => setFormData({...formData, billing_frequency: e.target.value})}
                                required
                              >
                                  <option value="">Frequency...</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="yearly">Yearly</option>
                              </Select>
                          </div>
                      )}
                  </div>

                  <div className="md:col-span-4 flex gap-2">
                      <Button type="submit" variant="success">Save Item</Button>
                      <Button onClick={() => setShowForm(false)} variant="secondary">Cancel</Button>
                  </div>
              </form>
          </div>
      )}

      <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm text-white">
              <thead className="bg-black/20 text-xs uppercase font-bold text-slate-500">
                  <tr>
                      <th className="p-4">Type</th>
                      <th className="p-4">Item Name</th>
                      <th className="p-4 text-right">Unit Price</th>
                      <th className="p-4 text-center">Frequency</th>
                      {isAdmin && <th className="p-4 text-right">Action</th>}
                  </tr>
              </thead>
              <tbody>
                  {products.map(p => {
                      const typeInfo = getTypeInfo(p.type);
                      return (
                          <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                              <td className="p-4">
                                  <Badge variant={typeInfo.color}>
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
                              <td className="p-4 text-center">
                                  {p.is_recurring ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-900/30 text-purple-300 text-xs font-bold border border-purple-500/30">
                                          <Calendar size={12} /> {p.billing_frequency?.toUpperCase()}
                                      </span>
                                  ) : (
                                      <span className="text-xs opacity-30 text-slate-500">ONE-OFF</span>
                                  )}
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
                      );
                  })}
              </tbody>
          </table>
          {products.length === 0 && <div className="p-8 text-center opacity-30">Catalog is empty.</div>}
      </Card>
    </Layout>
  );
}