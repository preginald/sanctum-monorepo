import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_TOASTS_PER_POLL = 3;

export default function useWorkbenchNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIdsRef = useRef(new Set());
  const { addToast } = useToast();
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/workbench/notifications');
      const data = res.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);

      // Fire toasts for new notification IDs
      const newItems = (data.notifications || []).filter(
        n => !seenIdsRef.current.has(n.id)
      );
      const toastBatch = newItems.slice(0, MAX_TOASTS_PER_POLL);
      for (const item of toastBatch) {
        addToast(item.title, 'info');
      }

      // Add all new IDs to seen set
      for (const item of newItems) {
        seenIdsRef.current.add(item.id);
      }
    } catch (e) {
      // Silently fail — polling should not disrupt the UI
      console.error('Workbench notifications poll failed', e);
    }
  }, [addToast]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
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
