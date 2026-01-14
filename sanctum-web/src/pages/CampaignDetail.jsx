import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { 
  Loader2, ArrowLeft, Users, Filter, CheckCircle, Save, Mail, Rocket, 
  RefreshCw, DollarSign, Target, TrendingUp 
} from 'lucide-react';
import api from '../lib/api';

// UI KIT
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('targets'); 

  // MODAL & FORM STATES
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterForm, setFilterForm] = useState({ account_status: '', brand_affinity: '' });
  
  // CONTENT STATE
  const [contentForm, setContentForm] = useState({ subject: '', body: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchCampaign(); }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await api.get(`/campaigns/${id}`);
      setCampaign(res.data);
      setContentForm({
          subject: res.data.subject_template || '',
          body: res.data.body_template || ''
      });
      
      const tRes = await api.get(`/campaigns/${id}/targets`);
      setTargets(tRes.data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleAddTargets = async (e) => {
      e.preventDefault();
      try {
          const res = await api.post(`/campaigns/${id}/targets/bulk`, filterForm);
          alert(res.data.message);
          setShowFilterModal(false);
          fetchCampaign();
      } catch (e) { alert("Failed to add targets"); }
  };

  const handleSaveContent = async () => {
      setIsSaving(true);
      try {
          await api.put(`/campaigns/${id}`, {
              subject_template: contentForm.subject,
              body_template: contentForm.body
          });
          alert("Saved.");
      } catch(e) { alert("Save failed"); }
      finally { setIsSaving(false); }
  };

  const handleSendTest = async () => {
      const email = prompt("Enter email for test:");
      if(!email) return;
      try {
          await api.post(`/campaigns/${id}/test`, null, { params: { target_email: email } });
          alert("Test sent.");
      } catch(e) { alert("Test failed."); }
  };

  const handleLaunch = async () => {
      const count = targets.filter(t => t.status === 'targeted').length;
      if(!confirm(`LAUNCH WARNING:\n\nYou are about to email ${count} people.\n\nThis cannot be undone. Proceed?`)) return;
      
      setIsSaving(true); 
      try {
          // Now returns immediately with status "processing"
          await api.post(`/campaigns/${id}/launch`);
          alert("Launch Sequence Initiated. Emails are sending in the background.");
          setActiveTab('targets');
          
          // Re-fetch shortly to show initial progress
          setTimeout(fetchCampaign, 2000);
      } catch(e) { 
          alert("Launch failed or partial success."); 
      } finally { 
          setIsSaving(false); 
      }
  };

  // Helpers
  const formatCurrency = (val) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(val);

  if (loading || !campaign) return <Layout title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  // ROI Calculation
  const roi = campaign.budget_cost > 0 
    ? ((campaign.total_deal_value - campaign.budget_cost) / campaign.budget_cost) * 100 
    : (campaign.total_deal_value > 0 ? 100 : 0);

  return (
    <Layout title="Campaign Command">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/campaigns')} />
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
                <Badge variant={campaign.status === 'active' ? 'success' : 'default'}>{campaign.status}</Badge>
                <span className="text-xs opacity-50 uppercase tracking-widest">{campaign.type} • {campaign.brand_affinity}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SCOREBOARD (ROI DASHBOARD) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          
          <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
                  <Target size={14} /> Reach
              </div>
              <div className="text-2xl font-bold text-white">
                  {campaign.sent_count} <span className="text-sm text-slate-500">/ {campaign.target_count}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(campaign.sent_count/campaign.target_count)*100}%` }}></div>
              </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
                  <DollarSign size={14} /> Pipeline Gen
              </div>
              <div className="text-2xl font-bold text-sanctum-gold">
                  {formatCurrency(campaign.total_deal_value)}
              </div>
              <div className="text-xs opacity-50 mt-1">{campaign.deal_count} Deals created</div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500 mb-2">
                  <TrendingUp size={14} /> Return on Spend
              </div>
              <div className={`text-2xl font-bold ${roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {roi.toFixed(0)}%
              </div>
              <div className="text-xs opacity-50 mt-1">Cost: {formatCurrency(campaign.budget_cost)}</div>
          </div>
          
           {/* CTA to link deals */}
           <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center">
              <Button variant="secondary" onClick={() => navigate('/deals')} size="sm">View Linked Deals</Button>
           </div>
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-700 mb-8">
          <button onClick={() => setActiveTab('targets')} className={`pb-2 px-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'targets' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>Targets</button>
          <button onClick={() => setActiveTab('content')} className={`pb-2 px-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'content' ? 'border-sanctum-gold text-sanctum-gold' : 'border-transparent text-slate-500 hover:text-white'}`}>Composer</button>
      </div>

      {/* --- TAB: TARGETS --- */}
      {activeTab === 'targets' && (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Users /> Target List</h3>
                  <div className="flex gap-2">
                      <Button variant="ghost" icon={RefreshCw} onClick={fetchCampaign} />
                      <Button variant="primary" icon={Filter} onClick={() => setShowFilterModal(true)}>Build List</Button>
                  </div>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-black/20 text-xs uppercase font-bold text-slate-500">
                          <tr>
                              <th className="p-4">Contact</th>
                              <th className="p-4">Email</th>
                              <th className="p-4">Status</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                          {targets.map(t => (
                              <tr key={t.id} className="hover:bg-white/5">
                                  <td className="p-4 font-bold text-white">{t.contact_name}</td>
                                  <td className="p-4">{t.contact_email}</td>
                                  <td className="p-4"><Badge variant={t.status === 'sent' ? 'success' : 'default'}>{t.status}</Badge></td>
                              </tr>
                          ))}
                          {targets.length === 0 && (
                              <tr><td colSpan="3" className="p-8 text-center opacity-50">No targets selected. Use the List Builder.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- TAB: CONTENT --- */}
      {activeTab === 'content' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-4">
                  <Card title="Email Blueprint">
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs uppercase opacity-50 block mb-1">Subject</label>
                              <input 
                                className="w-full p-3 bg-black/20 border border-slate-600 rounded text-white"
                                value={contentForm.subject}
                                onChange={e => setContentForm({...contentForm, subject: e.target.value})}
                                placeholder="e.g. Exclusive Invitation for {{company}}"
                              />
                          </div>
                          <div>
                              <label className="text-xs uppercase opacity-50 block mb-1">Body (HTML Supported)</label>
                              <textarea 
                                className="w-full p-3 h-64 bg-black/20 border border-slate-600 rounded text-white font-mono text-sm"
                                value={contentForm.body}
                                onChange={e => setContentForm({...contentForm, body: e.target.value})}
                                placeholder="Hi {{first_name}}, ..."
                              />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                              <p className="text-xs opacity-50">Variables: {'{{first_name}}'}, {'{{company}}'}</p>
                              <div className="flex gap-2">
                                  <Button variant="secondary" onClick={handleSaveContent} loading={isSaving}>Save Draft</Button>
                                  <Button variant="gold" icon={Mail} onClick={handleSendTest}>Send Test</Button>
                              </div>
                          </div>
                      </div>
                  </Card>
              </div>

              {/* LAUNCH PAD */}
              <div>
                  <Card title="Launch Control" className="border-red-500/30">
                      <div className="text-center space-y-4">
                          <div className="p-4 bg-red-500/10 rounded-full inline-block">
                              <Rocket size={32} className="text-red-500" />
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-white">Ready to Fire?</h3>
                              <p className="text-sm opacity-50">This will email {targets.filter(t => t.status === 'targeted').length} targets immediately.</p>
                          </div>
                          <Button 
                            variant="danger" 
                            className="w-full py-4 text-lg" 
                            onClick={handleLaunch}
                            loading={isSaving}
                            disabled={targets.length === 0}
                          >
                              LAUNCH CAMPAIGN
                          </Button>
                      </div>
                  </Card>
              </div>

          </div>
      )}

      {/* FILTER MODAL */}
      <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="Targeting Engine">
          <form onSubmit={handleAddTargets} className="space-y-4">
              <div>
                  <label className="text-xs text-slate-400 block mb-1">Account Status</label>
                  <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={filterForm.account_status} onChange={e => setFilterForm({...filterForm, account_status: e.target.value})}>
                      <option value="">All Statuses</option>
                      <option value="lead">Leads</option>
                      <option value="prospect">Prospects</option>
                      <option value="client">Active Clients</option>
                  </select>
              </div>
              <div>
                  <label className="text-xs text-slate-400 block mb-1">Brand Affinity</label>
                  <select className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white" value={filterForm.brand_affinity} onChange={e => setFilterForm({...filterForm, brand_affinity: e.target.value})}>
                      <option value="">All Brands</option>
                      <option value="ds">Digital Sanctum</option>
                      <option value="nt">Naked Tech</option>
                  </select>
              </div>
              <Button type="submit" className="w-full">Run Query & Add</Button>
          </form>
      </Modal>

    </Layout>
  );
}