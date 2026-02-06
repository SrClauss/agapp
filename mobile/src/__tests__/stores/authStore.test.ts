/**
 * Unit tests for authStore (Zustand state management)
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../stores/authStore';

jest.mock('expo-secure-store');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('AuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      token: null,
      user: null,
      activeRole: null,
      isHydrated: false,
    });
  });

  describe('Initial State', () => {
    it('should have null token and user initially', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.activeRole).toBeNull();
      expect(result.current.isHydrated).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should set token', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setToken('test-token-123');
      });
      
      expect(result.current.token).toBe('test-token-123');
    });

    it('should clear token when set to null', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setToken('test-token');
        await result.current.setToken(null);
      });
      
      expect(result.current.token).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should set user', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        cpf: '12345678900',
        roles: ['client'],
        is_active: true,
        is_profile_complete: true,
        credits: 10,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setUser(mockUser);
      });
      
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.user?.email).toBe('test@example.com');
    });

    it('should clear user when set to null', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setUser({
          id: 'user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          cpf: '12345678900',
          roles: ['client'],
          is_active: true,
          is_profile_complete: true,
          credits: 10,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        });
        await result.current.setUser(null);
      });
      
      expect(result.current.user).toBeNull();
    });
  });

  describe('setActiveRole', () => {
    it('should set active role', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setActiveRole('client');
      });
      
      expect(result.current.activeRole).toBe('client');
    });

    it('should update active role', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setActiveRole('client');
        result.current.setActiveRole('professional');
      });
      
      expect(result.current.activeRole).toBe('professional');
    });
  });

  describe('setHydrated', () => {
    it('should set hydrated flag', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.setHydrated();
      });
      
      expect(result.current.isHydrated).toBe(true);
    });
  });

  describe('getToken', () => {
    it('should return current token', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setToken('test-token-456');
      });
      
      expect(result.current.getToken()).toBe('test-token-456');
    });

    it('should return null when no token set', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.getToken()).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear all auth state', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useAuthStore());
      
      await act(async () => {
        await result.current.setToken('test-token');
        await result.current.setUser({
          id: 'user-123',
          email: 'test@example.com',
          full_name: 'Test User',
          cpf: '12345678900',
          roles: ['client'],
          is_active: true,
          is_profile_complete: true,
          credits: 10,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        });
        result.current.setActiveRole('client');
        
        await result.current.logout();
      });
      
      expect(result.current.token).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.activeRole).toBeNull();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth-storage');
    });
  });
});
