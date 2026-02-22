import React from 'react';
import Layout from '../components/Layout';
import useAuthStore from '../store/authStore';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import ClientDashboard from '../components/dashboard/ClientDashboard';

export default function Dashboard() {
  const { user } = useAuthStore();
  
  const isClient = user?.role === 'client';

  return (
    <Layout onRefresh={() => setRefreshKey(prev => prev + 1)} title={isClient ? "Client Portal" : "Command Center"}>
      {isClient ? (
        <ClientDashboard user={user} />
      ) : (
        <AdminDashboard />
      )}
    </Layout>
  );
}