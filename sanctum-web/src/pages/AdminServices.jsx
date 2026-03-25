import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Server, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import Loading from '../components/ui/Loading';

const SERVICES = ['sanctum-mcp'];

const STATUS_VARIANT = {
  active: 'success',
  inactive: 'warning',
  failed: 'danger',
  unknown: 'default',
};

export default function AdminServices() {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState({});
  const { addToast } = useToast();

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const results = {};
      for (const svc of SERVICES) {
        try {
          const res = await api.get(`/admin/services/${svc}/status`);
          results[svc] = res.data.status;
        } catch {
          results[svc] = 'unknown';
        }
      }
      setStatuses(results);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (service) => {
    setRestarting((prev) => ({ ...prev, [service]: true }));
    try {
      const res = await api.post(`/admin/services/${service}/restart`);
      setStatuses((prev) => ({ ...prev, [service]: res.data.status }));
      addToast(`${service} restarted successfully`, 'success');
    } catch (e) {
      const detail = e.response?.data?.detail || 'Restart failed';
      addToast(detail, 'error');
    } finally {
      setRestarting((prev) => ({ ...prev, [service]: false }));
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  if (loading && Object.keys(statuses).length === 0) {
    return (
      <Layout title="Service Management">
        <Loading message="Checking service status..." />
      </Layout>
    );
  }

  return (
    <Layout title="Service Management">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-400">
          Manage and monitor platform services
        </p>
        <Button
          onClick={fetchStatuses}
          disabled={loading}
          icon={RefreshCw}
          variant="ghost"
          size="sm"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4">
        {SERVICES.map((svc) => {
          const status = statuses[svc] || 'unknown';
          const variant = STATUS_VARIANT[status] || 'default';
          const isRestarting = restarting[svc];

          return (
            <Card key={svc} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server size={20} className="text-slate-400" />
                  <div>
                    <h3 className="text-white font-bold">{svc}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Systemd service</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={variant}>
                    {status.toUpperCase()}
                  </Badge>
                  <Button
                    onClick={() => handleRestart(svc)}
                    disabled={isRestarting}
                    variant="danger"
                    size="sm"
                    icon={RefreshCw}
                  >
                    {isRestarting ? 'Restarting...' : 'Restart'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
