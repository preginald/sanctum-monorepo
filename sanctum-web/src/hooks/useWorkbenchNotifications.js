import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

const POLL_INTERVAL = 30000; // 30 seconds

export default function useWorkbenchNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/workbench/notifications');
      const data = res.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      // Silently fail — polling should not disrupt the UI
      console.error('Workbench notifications poll failed', e);
    }
  }, []);

  useEffect(() => {
    // Fire initial fetch via timeout so setState runs in a callback,
    // not synchronously in the effect body (react-hooks/set-state-in-effect).
    const initialTimeout = setTimeout(fetchNotifications, 0);
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all notifications read', e);
    }
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
}
