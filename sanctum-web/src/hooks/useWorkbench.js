import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../lib/api';

export default function useWorkbench() {
  const [pins, setPins] = useState([]);
  const [maxPins, setMaxPins] = useState(6);
  const [loading, setLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);

  // Mirror isReordering in a ref so the 30s poll (set up once) always
  // reads the latest value without needing to re-create the interval.
  const isReorderingRef = useRef(false);
  useEffect(() => { isReorderingRef.current = isReordering; }, [isReordering]);

  const fetchPins = useCallback(async () => {
    try {
      const res = await api.get('/workbench');
      setPins(res.data.pins || []);
      setMaxPins(res.data.max_pins ?? 6);
    } catch (e) {
      console.error('Failed to fetch workbench pins', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // Poll for external pin changes (e.g. MCP/API) every 30s.
  // Skip the poll while a reorder PATCH is in flight so the GET response
  // cannot clobber the optimistic order.
  useEffect(() => {
    const id = setInterval(() => {
      if (isReorderingRef.current) return;
      fetchPins();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchPins]);

  const pinnedIds = useMemo(() => new Set(pins.map(p => p.project_id)), [pins]);

  const pinProject = useCallback(async (projectId) => {
    const prev = pins;
    try {
      await api.post('/workbench/pin', { project_id: projectId });
      // Gate refetch while a reorder is in flight — otherwise the
      // GET /workbench response would clobber the optimistic order.
      if (!isReorderingRef.current) await fetchPins();
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

  const reorderPins = useCallback(async (newOrder) => {
    const prev = pins;
    setIsReordering(true);
    setPins(newOrder);
    const payload = newOrder.map((p, i) => ({ project_id: p.project_id, position: i }));
    try {
      await api.patch('/workbench/reorder', { pin_order: payload });
      // No refetch — trust the optimistic state. Server response carries
      // no order data and a refetch would race the 30s poll.
    } catch (e) {
      setPins(prev);
      throw e;
    } finally {
      setIsReordering(false);
    }
  }, [pins]);

  return {
    pins,
    maxPins,
    loading,
    isReordering,
    pinnedIds,
    pinProject,
    unpinProject,
    reorderPins,
    refetch: fetchPins,
  };
}
