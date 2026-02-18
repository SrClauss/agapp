import { create } from 'zustand';

interface ChatState {
  isChatOpen: boolean;
  activeContactId: string | null;
  unreadCount: number;
  openChat: (contactId: string) => void;
  closeChat: () => void;
  setUnreadCount: (count: number) => void;
  loadUnreadCount: () => Promise<void>;
}

const useChatStore = create<ChatState>((set) => ({
  isChatOpen: false,
  activeContactId: null,
  unreadCount: 0,
  openChat: (contactId: string) => set({ isChatOpen: true, activeContactId: contactId }),
  closeChat: () => set({ isChatOpen: false, activeContactId: null }),
  setUnreadCount: (count: number) => set({ unreadCount: count }),
  loadUnreadCount: async () => {
    try {
      const { getContactHistory } = await import('../api/contacts');
      const { default: useAuthStore } = await import('./authStore');
      
      const user = useAuthStore.getState().user;
      if (!user) return;
      
      const userType = user.roles.includes('professional') ? 'professional' : 'client';
      const contacts = await getContactHistory(userType);
      
      // Count total unread messages
      let total = 0;
      for (const contact of contacts) {
        const chat = contact.chat || [];
        for (const msg of chat) {
          if (msg.sender_id !== user.id && !msg.read) {
            total++;
          }
        }
      }
      
      set({ unreadCount: total });
    } catch (error) {
      console.warn('[ChatStore] Failed to load unread count:', error);
    }
  },
}));

export default useChatStore;
