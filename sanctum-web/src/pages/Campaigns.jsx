import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { Plus, Megaphone, Target, Mail } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

// UI KIT
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

export default function Campaigns() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'email', brand_affinity: 'ds' });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/campaigns');
        setCampaigns(res.data);
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    };
    if (token) fetch();
  }, [token, refreshKey]);

  const handleCreate = async (e) => {
      e.preventDefault();
      try {
          const res = await api.post('/campaigns', form);
          addToast("Campaign initialized", "success");
          navigate(`/campaigns/${res.data.id}`);
      } catch (e) { 
          addToast("Failed to create campaign", "error");
      }
  };

  if (loading) {
    return (
      <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="The War Room">
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)}
      title="The War Room"
      subtitle="Campaign management and outreach operations"
      actions={
        <Button variant="gold" icon={Plus} onClick={() => setShowModal(true)}>New Campaign</Button>
      }
    >

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(c => (
              <Card 
                key={c.id} 
                className="hover:border-sanctum-gold/50 cursor-pointer transition-all group"
              >
                  <div onClick={() => navigate(`/campaigns/${c.id}`)}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-white/5 rounded border border-white/10">
                            <Megaphone className="text-sanctum-gold" size={20} />
                        </div>
                        <Badge variant={c.status === 'active' ? 'success' : 'default'}>{c.status}</Badge>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-sanctum-gold">{c.name}</h3>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mb-4">{c.type} • {c.brand_affinity}</div>
                    
                    <div className="pt-4 border-t border-slate-800 flex justify-between text-sm text-slate-400">
                        <div className="flex items-center gap-2"><Target size={14}/> {c.target_count} Targets</div>
                        <div className="flex items-center gap-2"><Mail size={14}/> {c.sent_count} Sent</div>
                    </div>
                  </div>
              </Card>
          ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Initialize Campaign">
          <form onSubmit={handleCreate} className="space-y-4">
              <Input 
                required 
                placeholder="Campaign Name" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
              />
              <div className="grid grid-cols-2 gap-4">
                  <Select 
                    value={form.type} 
                    onChange={e => setForm({...form, type: e.target.value})}
                  >
                      <option value="email">Email Blast</option>
                      <option value="linkedin">LinkedIn Outreach</option>
                  </Select>
                  <Select 
                    value={form.brand_affinity} 
                    onChange={e => setForm({...form, brand_affinity: e.target.value})}
                  >
                      <option value="ds">Digital Sanctum</option>
                      <option value="nt">Naked Tech</option>
                  </Select>
              </div>
              <Button type="submit" className="w-full">Create</Button>
          </form>
      </Modal>
    </Layout>
  );
}
