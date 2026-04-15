import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';

export default function useWorkbench() {
  const [pins, setPins] = useState([]);
  const [maxPins, setMaxPins] = useState(5);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    try {
      const res = await api.get('/workbench');
      setPins(res.data.pins || []);
      setMaxPins(res.data.max_pins || 5);
    } catch (e) {
      console.error('Failed to fetch workbench pins', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // Poll for external pin changes (e.g. MCP/API) every 30s
  useEffect(() => {
    const id = setInterval(fetchPins, 30000);
    return () => clearInterval(id);
  }, [fetchPins]);

  const pinnedIds = useMemo(() => new Set(pins.map(p => p.project_id)), [pins]);

  const pinProject = useCallback(async (projectId) => {
    const prev = pins;
    try {
      await api.post('/workbench/pin', { project_id: projectId });
      await fetchPins();
    } catch (e) {
      setPins(prev);
      throw e;
    }
  }, [pins, fetchPins]);

  const unpinProject = useCallback(async (projectId) => {
    const prev = pins;
    setPins(cur => cur.filter(p => p.project_id !== projectId));
    try {
      await api.delete(`/workbench/pin/${projectId}`);
    } catch (e) {
      setPins(prev);
      throw e;
    }
  }, [pins]);

  return { pins, maxPins, loading, pinnedIds, pinProject, unpinProject, refetch: fetchPins };
}
