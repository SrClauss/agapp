/**
 * Unit tests for authStore
 * 
 * Tests authentication state management with Zustand
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

// Mock SecureStore before importing the store
jest.mock('expo-secure-store');

describe('authStore', () => {
  let useAuthStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock SecureStore implementations
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    
    // Re-import the store after mocks are set
    const authStoreModule = require('../../stores/authStore');
    useAuthStore = authStoreModule.useAuthStore;
  });

  it('should have initial state with no user and token', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should set user and token on login', () => {
    const { result } = renderHook(() => useAuthStore());
    
    const mockUser = {
      id: 'user123',
      email: 'test@example.com',
      full_name: 'Test User',
      cpf: '12345678900',
      roles: ['client'],
      is_active: true,
      is_profile_complete: true,
      credits: 10,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };
    
    const mockToken = 'mock-jwt-token';
    
    act(() => {
      result.current.setAuth(mockUser, mockToken);
    });
    
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should clear user and token on logout', () => {
    const { result } = renderHook(() => useAuthStore());
    
    // Set auth first
    act(() => {
      result.current.setAuth(
        { id: 'user123', email: 'test@example.com', roles: ['client'] },
        'mock-token'
      );
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    
    // Logout
    act(() => {
      result.current.logout();
    });
    
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should update user data', () => {
    const { result } = renderHook(() => useAuthStore());
    
    const initialUser = {
      id: 'user123',
      email: 'test@example.com',
      full_name: 'Test User',
      roles: ['client'],
      credits: 10,
    };
    
    act(() => {
      result.current.setAuth(initialUser, 'token');
    });
    
    const updatedData = {
      full_name: 'Updated Name',
      credits: 20,
    };
    
    act(() => {
      result.current.updateUser(updatedData);
    });
    
    expect(result.current.user?.full_name).toBe('Updated Name');
    expect(result.current.user?.credits).toBe(20);
    expect(result.current.user?.email).toBe('test@example.com'); // Should keep other fields
  });

  it('should persist token to SecureStore on setAuth', async () => {
    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.setAuth(
        { id: 'user123', email: 'test@example.com', roles: ['client'] },
        'persist-token'
      );
    });
    
    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_token',
        'persist-token'
      );
    });
  });

  it('should remove token from SecureStore on logout', async () => {
    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.logout();
    });
    
    await waitFor(() => {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });
  });

  it('should handle multiple role types', () => {
    const { result } = renderHook(() => useAuthStore());
    
    const professionalUser = {
      id: 'prof123',
      email: 'prof@example.com',
      roles: ['professional'],
    };
    
    act(() => {
      result.current.setAuth(professionalUser, 'token');
    });
    
    expect(result.current.user?.roles).toContain('professional');
  });

  it('should correctly identify authenticated state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.isAuthenticated).toBe(false);
    
    act(() => {
      result.current.setAuth({ id: '123', roles: [] }, 'token');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
  });
});
