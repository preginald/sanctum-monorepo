import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../lib/formatters';

export default function Analytics() {
  const [revenue, setRevenue] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      Promise.all([
          api.get('/analytics/revenue-trend'),
          api.get('/analytics/asset-reliability')
      ]).then(([revRes, assRes]) => {
          setRevenue(revRes.data);
          setAssets(assRes.data);
          setLoading(false);
      });
  }, [refreshKey]);

  if (loading) return <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="Loading..."><Loader2 className="animate-spin"/></Layout>;

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title="The Oracle">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* REVENUE CHART */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                  <TrendingUp className="text-green-500"/> Revenue Trend (6 Months)
              </h3>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenue}> {/* Changed to Area for sexiness */}
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="month" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} 
                            formatter={(value) => formatCurrency(value)}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#22c55e" fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* ASSET RELIABILITY */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                  <AlertTriangle className="text-orange-500"/> Most Problematic Assets
              </h3>
              <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={assets} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                          <Tooltip 
                             contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                             cursor={{fill: '#1e293b'}}
                          />
                          <Bar dataKey="tickets" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

      </div>
    </Layout>
  );
}
