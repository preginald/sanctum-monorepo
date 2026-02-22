import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Trash2, Plus, Calendar, Edit2, X } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { useToast } from '../context/ToastContext';
import { PRODUCT_TYPES } from '../lib/constants';

export default function Catalog() {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // EDIT STATE: null = hidden, 'new' = create mode, object = edit mode
  const [editMode, setEditMode] = useState(null); 
  
  const [formData, setFormData] = useState({
      name: '', 
      description: '', 
      type: 'service', 
      unit_price: '',
      is_recurring: false,      
      billing_frequency: ''     
  });

  const isAdmin = user?.scope === 'global';

  useEffect(() => { fetchProducts(); }, [refreshKey]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  // Setup Form for Edit
  const handleEditClick = (product) => {
      setFormData({
          name: product.name,
          description: product.description || '',
          type: product.type,
          unit_price: product.unit_price,
          is_recurring: product.is_recurring,
          billing_frequency: product.billing_frequency || ''
      });
      setEditMode(product); // Store full object to get ID
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Setup Form for Create
  const handleNewClick = () => {
      setFormData({ 
          name: '', description: '', type: 'service', unit_price: '', 
          is_recurring: false, billing_frequency: '' 
      });
      setEditMode('new');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const payload = { ...formData };
        if (!payload.is_recurring) {
            payload.billing_frequency = null;
        }

        if (editMode === 'new') {
            await api.post('/products', payload);
            addToast("Product added to catalog", "success");
        } else {
            // Update Mode
            await api.put(`/products/${editMode.id}`, payload);
            addToast("Product updated", "success");
        }

        setEditMode(null);
        fetchProducts();
    } catch (e) { 
        addToast("Failed to save product", "error");
    }
  };

  const handleDelete = async (id) => {
      if(!confirm("Archive this product? Existing assets/invoices will remain unchanged.")) return;
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
      <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="Service & Hardware Catalog">
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)}
      title="Service & Hardware Catalog"
      subtitle="Products, services, and recurring billing items"
      actions={isAdmin && !editMode ? (
        <Button onClick={handleNewClick} icon={Plus} className="bg-sanctum-gold text-slate-900 hover:bg-yellow-500 border-none">
          Add Item
        </Button>
      ) : null}
    >

      {editMode && (
          <div className="mb-6 bg-slate-800 border border-slate-700 p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white">
                      {editMode === 'new' ? 'New Catalogue Item' : 'Edit Item'}
                  </h3>
                  <button onClick={() => setEditMode(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
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
                  </div>

                  {/* NEW: Description Field */}
                  <div>
                      <label className="text-xs text-slate-400 block mb-1">Description (Optional)</label>
                      <textarea 
                          className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm h-20 focus:border-sanctum-gold outline-none"
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          placeholder="Internal notes or invoice default description..."
                      />
                  </div>

                  {/* RECURRING BILLING TOGGLE */}
                  <div className="flex items-center gap-4 py-4 border-t border-slate-700 mt-2">
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

                  <div className="flex gap-2">
                      <Button type="submit" variant="success">{editMode === 'new' ? 'Save Item' : 'Update Item'}</Button>
                      <Button onClick={() => setEditMode(null)} variant="secondary">Cancel</Button>
                  </div>
              </form>
          </div>
      )}

      <Card className="overflow-hidden p-0">
          <Table className="w-full text-left text-sm text-white">
              <TableHeader className="bg-black/20 text-xs uppercase font-bold text-slate-500">
                  <TableRow>
                      <TableHead className="p-4">Type</TableHead>
                      <TableHead className="p-4">Item Name</TableHead>
                      <TableHead className="p-4 text-right">Unit Price</TableHead>
                      <TableHead className="p-4 text-center">Frequency</TableHead>
                      {isAdmin && <TableHead className="p-4 text-right">Action</TableHead>}
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {products.map(p => {
                      const typeInfo = getTypeInfo(p.type);
                      return (
                          <TableRow key={p.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                              <TableCell className="p-4">
                                  <Badge variant={typeInfo.color}>
                                      {p.type}
                                  </Badge>
                              </TableCell>
                              <TableCell className="p-4">
                                  <div className="font-bold text-white">{p.name}</div>
                                  <div className="text-xs opacity-50">{p.description}</div>
                              </TableCell>
                              <TableCell className="p-4 text-right font-mono text-sanctum-gold">
                                  ${Number(p.unit_price).toFixed(2)}
                              </TableCell>
                              <TableCell className="p-4 text-center">
                                  {p.is_recurring ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-900/30 text-purple-300 text-xs font-bold border border-purple-500/30">
                                          <Calendar size={12} /> {p.billing_frequency?.toUpperCase()}
                                      </span>
                                  ) : (
                                      <span className="text-xs opacity-30 text-slate-500">ONE-OFF</span>
                                  )}
                              </TableCell>
                              {isAdmin && (
                                  <TableCell className="p-4 text-right">
                                      <div className="flex justify-end gap-2">
                                          <button 
                                            onClick={() => handleEditClick(p)} 
                                            className="text-slate-500 opacity-70 hover:opacity-100 hover:text-white transition-all"
                                            title="Edit Product"
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                          <button 
                                            onClick={() => handleDelete(p.id)} 
                                            className="text-red-500 opacity-50 hover:opacity-100 transition-opacity"
                                            title="Archive Product"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                      </div>
                                  </TableCell>
                              )}
                          </TableRow>
                      );
                  })}
              </TableBody>
          </Table>
          {products.length === 0 && <div className="p-8 text-center opacity-30">Catalog is empty.</div>}
      </Card>
    </Layout>
  );
}