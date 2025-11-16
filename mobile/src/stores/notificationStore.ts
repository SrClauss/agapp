import create from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../services/notification';
import { websocketService, WebSocketMessage } from '../services/websocket';
import { apiService } from '../services/api';
import { RootStackParamList } from '../../App';
import * as RootNavigation from '../navigation/RootNavigation';

export interface UnreadMessage {
  projectId: string;
  count: number;
  lastMessage?: string;
  lastSender?: string;
  lastTimestamp?: string;
}

interface NotificationStoreState {
  unreadMessages: Record<string, UnreadMessage>;
  totalUnread: number;
  isConnected: boolean;
  userId: string | null;
  listenersAdded: boolean;

  initializeNotifications: () => Promise<void>;
  addUnreadMessage: (projectId: string, message: string, sender: string) => void;
  markProjectAsRead: (projectId: string) => void;
  getUnreadCount: (projectId: string) => number;
  setupWebSocket: () => Promise<void>;
  handleWebSocketMessage: (message: WebSocketMessage) => Promise<void>;
  loadSavedUnread: () => Promise<void>;
}

const STORAGE_KEY = 'unread_messages';

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set, get) => ({
      unreadMessages: {},
      totalUnread: 0,
      isConnected: false,
      userId: null,
      listenersAdded: false,

      initializeNotifications: async () => {
        try {
          await notificationService.requestPermissions();

          // Add listeners only once
          if (!get().listenersAdded) {
            notificationService.addNotificationReceivedListener((notification) => {
              console.log('Notification received (store):', notification);
            });

            notificationService.addNotificationResponseReceivedListener((response) => {
              console.log('Notification response (store):', response);
              const data = response.notification.request.content.data;
              if (data?.type === 'chat_message' && data?.projectId) {
                // Navigate to project details when notification is tapped
                RootNavigation.navigate('ProjectDetails', { projectId: data.projectId });
              }
            });

            set({ listenersAdded: true });
          }
        } catch (e) {
          console.error('Error initializing notifications:', e);
        }
      },

      addUnreadMessage: (projectId, message, sender) => {
        const current = get().unreadMessages || {};
        const existing = current[projectId];
        const newObj = {
          ...current,
          [projectId]: {
            projectId,
            count: (existing?.count || 0) + 1,
            lastMessage: message,
            lastSender: sender,
            lastTimestamp: new Date().toISOString(),
          },
        };
        const total = Object.values(newObj).reduce((sum, m) => sum + (m.count || 0), 0);
        set({ unreadMessages: newObj, totalUnread: total });
        // also persist to AsyncStorage for backward compatibility
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newObj)).catch(console.error);
      },

      markProjectAsRead: (projectId) => {
        const current = { ...get().unreadMessages };
        if (current[projectId]) {
          delete current[projectId];
        }
        const total = Object.values(current).reduce((sum, m) => sum + (m.count || 0), 0);
        set({ unreadMessages: current, totalUnread: total });
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current)).catch(console.error);
      },

      getUnreadCount: (projectId) => {
        return get().unreadMessages[projectId]?.count || 0;
      },

      setupWebSocket: async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          const storedUserId = await AsyncStorage.getItem('user_id');
          if (!token || !storedUserId) return;
          set({ userId: storedUserId });
          websocketService.connect(storedUserId, token);
          set({ isConnected: true });
          websocketService.addMessageHandler(get().handleWebSocketMessage);
        } catch (error) {
          console.error('Error setting up WebSocket (store):', error);
        }
      },

      handleWebSocketMessage: async (message) => {
        console.log('WebSocket message in store:', message);
        if (message.type === 'new_message') {
          const { contact_id, message: chatMessage } = message;
          if (chatMessage.sender_id === get().userId) return;
          const projectTitle = 'Projeto';
          const senderName = chatMessage.sender_id;
          await notificationService.showChatNotification(projectTitle, senderName, chatMessage.content, contact_id);
          get().addUnreadMessage(contact_id, chatMessage.content, senderName);
        } else if (message.type === 'new_project') {
          const project = message.project;
          try {
            const token = await AsyncStorage.getItem('access_token');
            if (!token) return;
            const userData = await apiService.getCurrentUser(token);
            const prefs = userData.notification_preferences;
            if (!prefs?.enabled) return;
            // quick skill match & location check similar to old code
            let shouldNotify = true;
            if (prefs.match_skills && userData.skills && userData.skills.length > 0) {
              const projectSkills = project.skills_required || [];
              const hasMatchingSkill = userData.skills.some((userSkill: string) =>
                projectSkills.some((projectSkill: string) =>
                  projectSkill.toLowerCase().includes(userSkill.toLowerCase()) ||
                  userSkill.toLowerCase().includes(projectSkill.toLowerCase())
                )
              );
              if (!hasMatchingSkill) shouldNotify = false;
            }
            if (shouldNotify) {
              await notificationService.showProjectNotification('Novo Projeto Disponível', project.title, project._id);
            }
          } catch (error) {
            console.error('Error in project eligibility (store):', error);
          }
        } else if (message.type === 'contact_update') {
          const { contact_id, status } = message.contact;
          await notificationService.showProjectNotification('Atualização de Contato', `Status atualizado para: ${status}`, contact_id);
        }
      },

      loadSavedUnread: async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as Record<string, UnreadMessage>;
            const total = Object.values(parsed).reduce((sum, m) => sum + (m.count || 0), 0);
            set({ unreadMessages: parsed, totalUnread: total });
          }
        } catch (error) {
          console.error('Error loading unread messages (store):', error);
        }
      },
    }),
    {
      name: 'notification-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ unreadMessages: state.unreadMessages, totalUnread: state.totalUnread }),
    }
  )
);

export default useNotificationStore;
