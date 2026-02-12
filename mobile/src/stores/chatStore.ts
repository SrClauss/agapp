import { create } from 'zustand';

interface ChatState {
  isChatOpen: boolean;
  activeContactId: string | null;
  openChat: (contactId: string) => void;
  closeChat: () => void;
}

const useChatStore = create<ChatState>((set) => ({
  isChatOpen: false,
  activeContactId: null,
  openChat: (contactId: string) => set({ isChatOpen: true, activeContactId: contactId }),
  closeChat: () => set({ isChatOpen: false, activeContactId: null }),
}));

export default useChatStore;
