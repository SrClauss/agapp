/**
 * Unit tests for chatStore (Zustand state management)
 */
import { renderHook, act } from '@testing-library/react-native';
import useChatStore from '../../stores/chatStore';

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      isChatOpen: false,
      activeContactId: null,
    });
  });

  describe('Initial State', () => {
    it('should have chat closed and no active contact initially', () => {
      const { result } = renderHook(() => useChatStore());
      
      expect(result.current.isChatOpen).toBe(false);
      expect(result.current.activeContactId).toBeNull();
    });
  });

  describe('openChat', () => {
    it('should open chat with specified contact ID', () => {
      const { result } = renderHook(() => useChatStore());
      
      act(() => {
        result.current.openChat('contact-123');
      });
      
      expect(result.current.isChatOpen).toBe(true);
      expect(result.current.activeContactId).toBe('contact-123');
    });

    it('should switch to different contact when already open', () => {
      const { result } = renderHook(() => useChatStore());
      
      act(() => {
        result.current.openChat('contact-123');
      });
      
      expect(result.current.activeContactId).toBe('contact-123');
      
      act(() => {
        result.current.openChat('contact-456');
      });
      
      expect(result.current.isChatOpen).toBe(true);
      expect(result.current.activeContactId).toBe('contact-456');
    });

    it('should handle empty contact ID', () => {
      const { result } = renderHook(() => useChatStore());
      
      act(() => {
        result.current.openChat('');
      });
      
      expect(result.current.isChatOpen).toBe(true);
      expect(result.current.activeContactId).toBe('');
    });
  });

  describe('closeChat', () => {
    it('should close chat and clear active contact', () => {
      const { result } = renderHook(() => useChatStore());
      
      // First open a chat
      act(() => {
        result.current.openChat('contact-123');
      });
      
      expect(result.current.isChatOpen).toBe(true);
      expect(result.current.activeContactId).toBe('contact-123');
      
      // Then close it
      act(() => {
        result.current.closeChat();
      });
      
      expect(result.current.isChatOpen).toBe(false);
      expect(result.current.activeContactId).toBeNull();
    });

    it('should handle closing when already closed', () => {
      const { result } = renderHook(() => useChatStore());
      
      act(() => {
        result.current.closeChat();
      });
      
      expect(result.current.isChatOpen).toBe(false);
      expect(result.current.activeContactId).toBeNull();
    });
  });

  describe('State persistence', () => {
    it('should maintain state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useChatStore());
      const { result: result2 } = renderHook(() => useChatStore());
      
      act(() => {
        result1.current.openChat('contact-789');
      });
      
      expect(result2.current.isChatOpen).toBe(true);
      expect(result2.current.activeContactId).toBe('contact-789');
    });
  });
});
