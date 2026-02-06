/**
 * Unit tests for auth API
 */
import {
  loginWithEmail,
  signUpWithEmail,
  loginWithGoogle,
  fetchCurrentUser,
  registerFcmToken,
  completeProfile,
} from '../../api/auth';
import client from '../../api/axiosClient';

jest.mock('../../api/axiosClient');
jest.mock('../../stores/authStore', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({ token: 'mock-token', user: { id: 'user-123' } })),
  },
}));

const mockClient = client as jest.Mocked<typeof client>;

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loginWithEmail', () => {
    it('should login successfully with email and password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      mockClient.post.mockResolvedValue({
        data: { access_token: 'token-123', user: mockUser },
      });

      const result = await loginWithEmail('test@example.com', 'password123');

      expect(mockClient.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      expect(result.token).toBe('token-123');
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error on failed login', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          data: { detail: 'Invalid credentials' },
        },
      });

      await expect(
        loginWithEmail('test@example.com', 'wrong-password')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should include turnstile token when provided', async () => {
      mockClient.post.mockResolvedValue({
        data: { access_token: 'token-123', user: {} },
      });

      await loginWithEmail('test@example.com', 'password', 'turnstile-token');

      const params = mockClient.post.mock.calls[0][1] as URLSearchParams;
      expect(params.get('turnstile_token')).toBe('turnstile-token');
    });
  });

  describe('signUpWithEmail', () => {
    it('should sign up successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      mockClient.post.mockResolvedValue({ data: mockUser });

      const signUpData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
        cpf: '12345678900',
        phone: '11987654321',
        roles: ['client'],
      };

      const result = await signUpWithEmail(signUpData);

      expect(mockClient.post).toHaveBeenCalledWith('/auth/register', signUpData);
      expect(result).toEqual(mockUser);
    });

    it('should throw error on failed signup', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          data: { detail: 'Email already exists' },
        },
      });

      await expect(
        signUpWithEmail({
          email: 'test@example.com',
          password: 'password123',
          full_name: 'Test User',
          cpf: '12345678900',
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('loginWithGoogle', () => {
    it('should login with Google successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      mockClient.post.mockResolvedValue({
        data: { access_token: 'token-123', user: mockUser },
      });

      const result = await loginWithGoogle('google-id-token');

      expect(mockClient.post).toHaveBeenCalledWith('/auth/google', {
        idToken: 'google-id-token',
      });
      expect(result.token).toBe('token-123');
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error on failed Google login', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          data: { detail: 'Invalid Google token' },
        },
      });

      await expect(loginWithGoogle('invalid-token')).rejects.toThrow(
        'Invalid Google token'
      );
    });
  });

  describe('fetchCurrentUser', () => {
    it('should fetch current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
      };

      mockClient.get.mockResolvedValue({ data: mockUser });

      const result = await fetchCurrentUser('token-123');

      expect(mockClient.get).toHaveBeenCalledWith('/auth/me', {
        headers: { Authorization: 'Bearer token-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error on failed fetch', async () => {
      mockClient.get.mockRejectedValue(new Error('Network error'));

      await expect(fetchCurrentUser('token-123')).rejects.toThrow(
        'Failed fetching user'
      );
    });
  });

  describe('registerFcmToken', () => {
    it('should register FCM token successfully', async () => {
      mockClient.post.mockResolvedValue({ data: { success: true } });

      const result = await registerFcmToken(
        'token-123',
        'fcm-token-456',
        'device-id',
        'Device Name'
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        '/users/me/fcm-token',
        {
          fcm_token: 'fcm-token-456',
          device_id: 'device-id',
          device_name: 'Device Name',
        },
        { headers: { Authorization: 'Bearer token-123' } }
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw error on failed FCM registration', async () => {
      mockClient.post.mockRejectedValue({
        response: {
          data: { detail: 'Invalid token' },
        },
      });

      await expect(
        registerFcmToken('token-123', 'fcm-token')
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('completeProfile', () => {
    it('should complete profile successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        is_profile_complete: true,
      };

      mockClient.put.mockResolvedValue({ data: mockUser });

      const profileData = {
        phone: '11987654321',
        cpf: '12345678900',
        full_name: 'Test User',
        password: 'password123',
        roles: ['client'],
      };

      const result = await completeProfile('token-123', profileData);

      expect(mockClient.put).toHaveBeenCalledWith(
        '/auth/complete-profile',
        profileData,
        { headers: { Authorization: 'Bearer token-123' } }
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error on failed profile completion', async () => {
      mockClient.put.mockRejectedValue({
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { detail: 'Invalid CPF' },
        },
      });

      await expect(
        completeProfile('token-123', {
          phone: '11987654321',
          cpf: 'invalid',
          full_name: 'Test User',
          password: 'password123',
          roles: ['client'],
        })
      ).rejects.toThrow('Invalid CPF');
    });
  });
});
