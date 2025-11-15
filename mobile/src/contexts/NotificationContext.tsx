import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notification';
import { websocketService, WebSocketMessage } from '../services/websocket';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

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

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [unreadMessages, setUnreadMessages] = useState<Map<string, UnreadMessage>>(new Map());
  const [totalUnread, setTotalUnread] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load unread messages from storage
  useEffect(() => {
    loadUnreadMessages();
  }, []);

  // Update badge count when unread changes
  useEffect(() => {
    const total = Array.from(unreadMessages.values()).reduce((sum, msg) => sum + msg.count, 0);
    setTotalUnread(total);
    notificationService.setBadgeCount(total);
  }, [unreadMessages]);

  // Setup WebSocket connection
  useEffect(() => {
    setupWebSocket();
    return () => {
      websocketService.disconnect();
    };
  }, []);

  // Setup notification listeners
  useEffect(() => {
    const receivedSubscription = notificationService.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    const responseSubscription = notificationService.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;

      if (data.type === 'chat_message' && data.projectId) {
        // Navigate to project details when notification is tapped
        // This would need navigation ref or deep linking
        console.log('Navigate to project:', data.projectId);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const loadUnreadMessages = async () => {
    try {
      const stored = await AsyncStorage.getItem('unread_messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        const map = new Map(Object.entries(parsed));
        setUnreadMessages(map);
      }
    } catch (error) {
      console.error('Error loading unread messages:', error);
    }
  };

  const saveUnreadMessages = async (messages: Map<string, UnreadMessage>) => {
    try {
      const obj = Object.fromEntries(messages);
      await AsyncStorage.setItem('unread_messages', JSON.stringify(obj));
    } catch (error) {
      console.error('Error saving unread messages:', error);
    }
  };

  const setupWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const storedUserId = await AsyncStorage.getItem('user_id');

      if (!token || !storedUserId) {
        return;
      }

      setUserId(storedUserId);

      // Connect WebSocket
      websocketService.connect(storedUserId, token);
      setIsConnected(true);

      // Add message handler
      websocketService.addMessageHandler(handleWebSocketMessage);
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
    }
  };

  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage) => {
    console.log('WebSocket message in context:', message);

    if (message.type === 'new_message') {
      const { contact_id, message: chatMessage } = message;

      // Don't show notification for own messages
      if (chatMessage.sender_id === userId) {
        return;
      }

      // Get project info (you might need to fetch this)
      const projectTitle = 'Projeto'; // TODO: Get from cache or API
      const senderName = chatMessage.sender_id; // TODO: Get actual name

      // Show notification
      await notificationService.showChatNotification(
        projectTitle,
        senderName,
        chatMessage.content,
        contact_id
      );

      // Add to unread
      addUnreadMessage(contact_id, chatMessage.content, senderName);
    } else if (message.type === 'new_project') {
      // New project notification for professionals
      const project = message.project;
      await notificationService.showProjectNotification(
        'Novo Projeto Disponível',
        project.title,
        project._id
      );
    } else if (message.type === 'contact_update') {
      // Contact status update notification
      const { contact_id, status } = message.contact;
      await notificationService.showProjectNotification(
        'Atualização de Contato',
        `Status atualizado para: ${status}`,
        contact_id
      );
    }
  }, [userId]);

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

  return (
    <NotificationContext.Provider
      value={{
        unreadMessages,
        totalUnread,
        markProjectAsRead,
        addUnreadMessage,
        getUnreadCount,
        initializeNotifications,
        isConnected,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
