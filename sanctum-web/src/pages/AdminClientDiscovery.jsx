import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import QuestionnaireForm from '../components/audits/QuestionnaireForm';
import api from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function AdminClientDiscovery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [initialData, setInitialData] = useState({});

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      // FIX: Use the standard CRM endpoint, not the non-existent /admin/ endpoint
      // This endpoint returns the full Account object including audit_data
      const res = await api.get(`/accounts/${id}`);
      
      setClientName(res.data.name);
      
      // If client has existing audit data (scoping_responses), load it. 
      if (res.data.audit_data && res.data.audit_data.scoping_responses) {
        setInitialData(res.data.audit_data.scoping_responses);
      }
    } catch (error) {
      console.error('Failed to load client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    // Admin submitting on behalf of client
    // We use a specific admin endpoint to update the audit_data blob
    await api.patch(`/admin/accounts/${id}/audit-data`, formData); // Send formData directly, schema expects QuestionnaireSubmit
    
    // Redirect back to client detail
    navigate(`/clients/${id}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="mb-6">
            <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">
                Admin Discovery Mode
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
                Recording infrastructure details for <strong className="text-white">{clientName}</strong>
            </p>
        </div>
        
        <QuestionnaireForm 
          initialData={initialData}
          onSubmit={handleSubmit}
          mode="admin"
          onCancel={() => navigate(`/clients/${id}`)}
        />
      </div>
    </Layout>
  );
}