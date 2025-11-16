import React, { ReactNode, useEffect } from 'react';
import useNotificationStore from '../stores/notificationStore';

/**
 * Compatibility shim: older code using NotificationProvider/useNotifications
 * will now be forwarded to the zustand store.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const initStore = async () => {
      const store = useNotificationStore.getState();
      try {
        await store.loadSavedUnread();
        await store.initializeNotifications();
        await store.setupWebSocket();
      } catch (err) {
        console.error('Error initializing notification store (shim):', err);
      }
    };
    initStore();
  }, []);

  return <>{children}</>;
}

export function useNotifications() {
  const { unreadMessages, totalUnread, markProjectAsRead, addUnreadMessage, getUnreadCount, initializeNotifications, isConnected } = useNotificationStore((s) => ({
    unreadMessages: s.unreadMessages,
    totalUnread: s.totalUnread,
    markProjectAsRead: s.markProjectAsRead,
    addUnreadMessage: s.addUnreadMessage,
    getUnreadCount: s.getUnreadCount,
    initializeNotifications: s.initializeNotifications,
    isConnected: s.isConnected,
  }));

  const unreadMap = new Map(Object.entries(unreadMessages || {}));

  return {
    unreadMessages: unreadMap,
    totalUnread,
    markProjectAsRead,
    addUnreadMessage,
    getUnreadCount,
    initializeNotifications,
    isConnected,
  };
}

export default useNotificationStore;
import React, { ReactNode, useEffect } from 'react';
import useNotificationStore from '../stores/notificationStore';

export function NotificationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const store = useNotificationStore.getState();
        await store.loadSavedUnread();
        await store.initializeNotifications();
        await store.setupWebSocket();
      } catch (err) {
        console.error('Error initializing notification store (shim):', err);
      }
    })();
  }, []);

  return <>{children}</>;
}

export function useNotifications() {
  const { unreadMessages, totalUnread, markProjectAsRead, addUnreadMessage, getUnreadCount, initializeNotifications, isConnected } = useNotificationStore((s) => ({
    unreadMessages: s.unreadMessages,
    totalUnread: s.totalUnread,
    markProjectAsRead: s.markProjectAsRead,
    addUnreadMessage: s.addUnreadMessage,
    getUnreadCount: s.getUnreadCount,
    initializeNotifications: s.initializeNotifications,
    isConnected: s.isConnected,
  }));

  const unreadMap = new Map(Object.entries(unreadMessages || {}));

  return {
    unreadMessages: unreadMap,
    totalUnread,
    markProjectAsRead,
    addUnreadMessage,
    getUnreadCount,
    initializeNotifications,
    isConnected,
  };
}

export default useNotificationStore;
import React, { ReactNode, useEffect } from 'react';
import useNotificationStore from '../stores/notificationStore';

export function NotificationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const store = useNotificationStore.getState();
        await store.loadSavedUnread();
        await store.initializeNotifications();
        await store.setupWebSocket();
      } catch (err) {
        console.error('Error initializing notification store (shim):', err);
      }
    })();
  }, []);

  return <>{children}</>;
}

export function useNotifications() {
  const { unreadMessages, totalUnread, markProjectAsRead, addUnreadMessage, getUnreadCount, initializeNotifications, isConnected } = useNotificationStore((s) => ({
    unreadMessages: s.unreadMessages,
    totalUnread: s.totalUnread,
    markProjectAsRead: s.markProjectAsRead,
    addUnreadMessage: s.addUnreadMessage,
    getUnreadCount: s.getUnreadCount,
    initializeNotifications: s.initializeNotifications,
    isConnected: s.isConnected,
  }));

  // Convert object to Map for backward compatibility
  const unreadMap = new Map(Object.entries(unreadMessages || {}));

  return {
    unreadMessages: unreadMap,
    totalUnread,
    markProjectAsRead,
    addUnreadMessage,
    getUnreadCount,
    initializeNotifications,
    isConnected,
  };
}

export default useNotificationStore;
import React, { ReactNode, useEffect } from 'react';
import useNotificationStore from '../stores/notificationStore';

interface UnreadMessage {
  projectId: string;
  count: number;
  lastMessage?: string;
  lastSender?: string;
  lastTimestamp?: string;
}

interface NotificationContextData {
  unreadMessages: Map<string, UnreadMessage>;
  totalUnread: number;
  markProjectAsRead: (projectId: string) => void;
  addUnreadMessage: (projectId: string, message: string, sender: string) => void;
  getUnreadCount: (projectId: string) => number;
  initializeNotifications: () => Promise<void>;
  isConnected: boolean;
}

interface NotificationProviderProps {
  children: ReactNode;
}

// This file is a compatibility shim that keeps the old Context API signature
// while delegating all logic to the new zustand store. It allows a safer
// migration with minimal changes to the rest of the app.

export function NotificationProvider({ children }: NotificationProviderProps) {
  useEffect(() => {
    (async () => {
      try {
        const store = useNotificationStore.getState();
        await store.loadSavedUnread();
        await store.initializeNotifications();
        await store.setupWebSocket();
      } catch (err) {
        console.error('Error initializing notification store (shim):', err);
      }
    })();
  }, []);

  return <>{children}</>;
}

export function useNotifications(): NotificationContextData {
  const { unreadMessages, totalUnread, markProjectAsRead, addUnreadMessage, getUnreadCount, initializeNotifications, isConnected } = useNotificationStore((s) => ({
    unreadMessages: s.unreadMessages,
    totalUnread: s.totalUnread,
    markProjectAsRead: s.markProjectAsRead,
    addUnreadMessage: s.addUnreadMessage,
    getUnreadCount: s.getUnreadCount,
    initializeNotifications: s.initializeNotifications,
    isConnected: s.isConnected,
  }));

  // Convert object to Map to preserve previous type and behavior
  const unreadMap = new Map<string, UnreadMessage>(Object.entries(unreadMessages || {}));

  return {
    unreadMessages: unreadMap,
    totalUnread,
    markProjectAsRead,
    addUnreadMessage,
    getUnreadCount,
    initializeNotifications,
    isConnected,
  };
}

export default useNotificationStore;
import React, { useEffect, ReactNode } from 'react';
import useNotificationStore from '../stores/notificationStore';

interface UnreadMessage {
  projectId: string;
  count: number;
  lastMessage?: string;
  lastSender?: string;
  lastTimestamp?: string;
}

interface NotificationContextData {
  unreadMessages: Map<string, UnreadMessage>;
  totalUnread: number;
  markProjectAsRead: (projectId: string) => void;
  addUnreadMessage: (projectId: string, message: string, sender: string) => void;
  getUnreadCount: (projectId: string) => number;
  initializeNotifications: () => Promise<void>;
  isConnected: boolean;
}

// Backwards compatibility shim: route old context API to zustand store
const NotificationContext = null as unknown as any;

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // This provider no longer supplies context - keep as compatibility wrapper for mount side-effects.
  const init = useNotificationStore((s) => s.initializeNotifications);
  const loadSaved = useNotificationStore((s) => s.loadSavedUnread);

  useEffect(() => {
    loadSaved();
    init();
  export function NotificationProvider({ children }: NotificationProviderProps) {
    const init = useNotificationStore.getState().initializeNotifications;
    const loadSaved = useNotificationStore.getState().loadSavedUnread;

    useEffect(() => {
      (async () => {
        try {
          await loadSaved();
          await init();
        } catch (e) {
          console.error('Error initializing notification provider (shim):', e);
        }
      })();
    }, []);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const markProjectAsRead = useCallback((projectId: string) => {
    setUnreadMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(projectId);
      saveUnreadMessages(newMap);
      return newMap;
    });
  }, []);

  const addUnreadMessage = useCallback((projectId: string, message: string, sender: string) => {
    setUnreadMessages((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      newMap.set(projectId, {
        projectId,
        count: (existing?.count || 0) + 1,
        lastMessage: message,
        lastSender: sender,
        lastTimestamp: new Date().toISOString(),
      });

      saveUnreadMessages(newMap);
      return newMap;
    });
  }, []);

  const getUnreadCount = useCallback((projectId: string): number => {
    return unreadMessages.get(projectId)?.count || 0;
  }, [unreadMessages]);

  const initializeNotifications = useCallback(async () => {
    await notificationService.requestPermissions();
  }, []);

  return <>{children}</>;
}

export function useNotifications() {
  // adapt to new zustand store
  const { unreadMessages, totalUnread, markProjectAsRead, addUnreadMessage, getUnreadCount, initializeNotifications, isConnected } = useNotificationStore((s) => ({
    unreadMessages: s.unreadMessages,
    totalUnread: s.totalUnread,
    markProjectAsRead: s.markProjectAsRead,
    addUnreadMessage: s.addUnreadMessage,
    getUnreadCount: s.getUnreadCount,
    initializeNotifications: s.initializeNotifications,
    isConnected: s.isConnected,
  }));

  // Return Map for backward compatibility in case some code expects it
  const unreadMap = new Map<string, UnreadMessage>(Object.entries(unreadMessages || {}));

  return {
    unreadMessages: unreadMap,
    totalUnread,
    markProjectAsRead,
    addUnreadMessage,
    getUnreadCount,
    initializeNotifications,
    isConnected,
  };
}
