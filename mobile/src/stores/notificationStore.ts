import { create } from 'zustand';

/*
  Notification store
  - use `useNotificationStore` in React components to read the current `count` and actions (setCount/inc/dec/reset)
  - For non-react code (e.g. WebSocket message handler), use exported helpers:
    import { setNotificationCount, incNotification, decNotification, resetNotification } from '../stores/notificationStore'
*/

export type NotificationState = {
  count: number;
  setCount: (n: number) => void;
  inc: (by?: number) => void;
  dec: (by?: number) => void;
  reset: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  count: 0,
  setCount: (n: number) => set({ count: Math.max(0, n) }),
  inc: (by: number = 1) => set((s) => ({ count: s.count + by })),
  dec: (by: number = 1) => set((s) => ({ count: Math.max(0, s.count - by) })),
  reset: () => set({ count: 0 }),
}));

export default useNotificationStore;

// Optional: exported helper functions for external non-react usage
export const setNotificationCount = (n: number) => useNotificationStore.getState().setCount(n);
export const incNotification = (by: number = 1) => useNotificationStore.getState().inc(by);
export const decNotification = (by: number = 1) => useNotificationStore.getState().dec(by);
export const resetNotification = () => useNotificationStore.getState().reset();
