import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Plus } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

// UI Components
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Loading from '../components/ui/Loading';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

export default function Clients() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'business', brand_affinity: 'ds' });

  const isAdmin = user?.role !== 'client';

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/accounts');
        setAccounts(response.data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    if (token) fetchAccounts();
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts', form);
      setShowModal(false);
      addToast("Client onboarded successfully", "success");
      window.location.reload(); 
    } catch (e) { 
      addToast("Failed to create client", "error");
    }
  };

  if (loading) {
    return (
      <Layout title="Client Registry">
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout title="Client Registry">
      <div className="flex justify-end mb-6">
        {isAdmin && (
            <Button 
              onClick={() => setShowModal(true)} 
              icon={Plus}
              variant="gold"
            >
              New Client
            </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left">
          <thead className="bg-black/20 text-xs uppercase text-slate-400 font-bold tracking-wider">
            <tr>
              <th className="p-4">Client Name</th>
              <th className="p-4">Type</th>
              <th className="p-4">Brand</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm text-white divide-y divide-slate-800">
            {accounts.map(account => (
              <tr 
                key={account.id} 
                onClick={() => navigate(`/clients/${account.id}`)}
                className="hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <td className="p-4 font-bold text-base group-hover:text-sanctum-gold transition-colors">
                    {account.name}
                </td>
                <td className="p-4 capitalize opacity-70">{account.type}</td>
                <td className="p-4">
                  {account.brand_affinity === 'ds' && <span className="text-sanctum-gold font-bold">SANCTUM</span>}
                  {account.brand_affinity === 'nt' && <span className="text-pink-500 font-bold">NAKED</span>}
                  {account.brand_affinity === 'both' && <span className="opacity-50">SHARED</span>}
                </td>
                <td className="p-4">
                  <Badge variant={account.status === 'client' ? 'success' : 'default'}>
                    {account.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && <div className="p-8 text-center opacity-50">No clients found.</div>}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Onboard Entity">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input 
            label="Entity Name"
            required 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
              <Select 
                label="Type"
                value={form.type} 
                onChange={e => setForm({...form, type: e.target.value})}
              >
                  <option value="business">Business</option>
                  <option value="residential">Residential</option>
              </Select>
              <Select 
                label="Brand"
                value={form.brand_affinity} 
                onChange={e => setForm({...form, brand_affinity: e.target.value})}
              >
                  <option value="ds">Digital Sanctum</option>
                  <option value="nt">Naked Tech</option>
                  <option value="both">Shared</option>
              </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" variant="gold" className="flex-1">Initialize</Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
